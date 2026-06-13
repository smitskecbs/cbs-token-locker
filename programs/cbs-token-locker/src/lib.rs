use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("DA1sh6XTa13QQ23sLNdcPfCZF5SGMKXXYLxcfAJYcCmU");

/// Maximum on-chain project name bytes stored for public verification.
pub const MAX_PROJECT_NAME_LEN: usize = 48;

#[program]
pub mod cbs_token_locker {
    use super::*;

    /// Create a deterministic on-chain lock account and vault, then deposit tokens.
    ///
    /// - Only the owner signer can create a lock for their wallet.
    /// - Mint and amount are validated against the source token account.
    /// - Unlock timestamp is enforced on-chain; early unlock is impossible.
    /// - No admin withdrawal path exists in this program.
    pub fn create_lock(
        ctx: Context<CreateLock>,
        amount: u64,
        unlock_timestamp: i64,
        lock_seed: u64,
        token_type: u8,
        project_name: String,
    ) -> Result<()> {
        require!(amount > 0, LockerError::InvalidAmount);
        require!(
            project_name.as_bytes().len() <= MAX_PROJECT_NAME_LEN,
            LockerError::ProjectNameTooLong
        );

        let now = Clock::get()?.unix_timestamp;
        require!(unlock_timestamp > now, LockerError::UnlockTimestampNotFuture);

        let source = &ctx.accounts.owner_token_account;
        require!(source.mint == ctx.accounts.mint.key(), LockerError::MintMismatch);
        require!(source.owner == ctx.accounts.owner.key(), LockerError::OwnerMismatch);
        require!(source.amount >= amount, LockerError::InsufficientBalance);
        require!(token_type <= 1, LockerError::InvalidTokenType);

        let lock = &mut ctx.accounts.lock;
        lock.owner = ctx.accounts.owner.key();
        lock.mint = ctx.accounts.mint.key();
        lock.vault = ctx.accounts.vault.key();
        lock.amount = amount;
        lock.unlock_timestamp = unlock_timestamp;
        lock.created_at = now;
        lock.lock_seed = lock_seed;
        lock.token_type = token_type;
        lock.is_unlocked = false;
        lock.bump = ctx.bumps.lock;
        lock.vault_bump = ctx.bumps.vault;
        lock.token_program = ctx.accounts.token_program.key();
        lock.project_name = pad_project_name(&project_name);

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.owner_token_account.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.owner.to_account_info(),
                },
            ),
            amount,
        )?;

        emit!(LockCreated {
            lock: lock.key(),
            owner: lock.owner,
            mint: lock.mint,
            vault: lock.vault,
            amount,
            unlock_timestamp,
            lock_seed,
            token_type,
        });

        Ok(())
    }

    /// Unlock tokens after the on-chain unlock timestamp.
    ///
    /// - Only the original owner can unlock.
    /// - Early unlock is rejected by on-chain clock validation.
    /// - Vault authority is the lock PDA; no third party can withdraw.
    pub fn unlock(ctx: Context<Unlock>) -> Result<()> {
        let lock = &ctx.accounts.lock;
        require!(!lock.is_unlocked, LockerError::AlreadyUnlocked);

        let now = Clock::get()?.unix_timestamp;
        require!(now >= lock.unlock_timestamp, LockerError::LockPeriodActive);

        let signer_seeds: &[&[&[u8]]] = &[&[
            b"lock",
            lock.owner.as_ref(),
            lock.mint.as_ref(),
            &lock.lock_seed.to_le_bytes(),
            &[lock.bump],
        ]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.owner_token_account.to_account_info(),
                    authority: ctx.accounts.lock.to_account_info(),
                },
                signer_seeds,
            ),
            lock.amount,
        )?;

        let lock = &mut ctx.accounts.lock;
        lock.is_unlocked = true;

        emit!(LockUnlocked {
            lock: lock.key(),
            owner: lock.owner,
            mint: lock.mint,
            amount: lock.amount,
        });

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(amount: u64, unlock_timestamp: i64, lock_seed: u64, token_type: u8, project_name: String)]
pub struct CreateLock<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        init,
        payer = owner,
        space = TokenLock::SPACE,
        seeds = [b"lock", owner.key().as_ref(), mint.key().as_ref(), lock_seed.to_le_bytes().as_ref()],
        bump
    )]
    pub lock: Account<'info, TokenLock>,

    pub mint: Account<'info, Mint>,

    #[account(
        init,
        payer = owner,
        seeds = [b"vault", lock.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = lock,
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = owner,
        associated_token::token_program = token_program,
    )]
    pub owner_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Unlock<'info> {
    #[account(mut, constraint = owner.key() == lock.owner @ LockerError::OwnerMismatch)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"lock", lock.owner.as_ref(), lock.mint.as_ref(), lock.lock_seed.to_le_bytes().as_ref()],
        bump = lock.bump,
    )]
    pub lock: Account<'info, TokenLock>,

    #[account(
        mut,
        address = lock.vault @ LockerError::VaultMismatch,
        constraint = vault.mint == lock.mint @ LockerError::MintMismatch,
        constraint = vault.amount >= lock.amount @ LockerError::InsufficientVaultBalance,
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = lock.mint,
        associated_token::authority = owner,
        associated_token::token_program = token_program,
    )]
    pub owner_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[account]
pub struct TokenLock {
    pub owner: Pubkey,
    pub mint: Pubkey,
    pub vault: Pubkey,
    pub amount: u64,
    pub unlock_timestamp: i64,
    pub created_at: i64,
    pub lock_seed: u64,
    pub token_type: u8,
    pub is_unlocked: bool,
    pub bump: u8,
    pub vault_bump: u8,
    pub token_program: Pubkey,
    pub project_name: [u8; MAX_PROJECT_NAME_LEN],
}

impl TokenLock {
    pub const SPACE: usize = 8 + 32 + 32 + 32 + 8 + 8 + 8 + 8 + 1 + 1 + 1 + 1 + 32 + MAX_PROJECT_NAME_LEN;
}

#[event]
pub struct LockCreated {
    pub lock: Pubkey,
    pub owner: Pubkey,
    pub mint: Pubkey,
    pub vault: Pubkey,
    pub amount: u64,
    pub unlock_timestamp: i64,
    pub lock_seed: u64,
    pub token_type: u8,
}

#[event]
pub struct LockUnlocked {
    pub lock: Pubkey,
    pub owner: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
}

#[error_code]
pub enum LockerError {
    #[msg("Amount must be greater than zero.")]
    InvalidAmount,
    #[msg("Unlock timestamp must be in the future.")]
    UnlockTimestampNotFuture,
    #[msg("Project name exceeds the on-chain limit.")]
    ProjectNameTooLong,
    #[msg("Token mint does not match the source account.")]
    MintMismatch,
    #[msg("Only the original owner can interact with this lock.")]
    OwnerMismatch,
    #[msg("Insufficient token balance in the source account.")]
    InsufficientBalance,
    #[msg("Invalid token type. Use 0 for SPL or 1 for LP.")]
    InvalidTokenType,
    #[msg("Lock is still active. Early unlock is not allowed.")]
    LockPeriodActive,
    #[msg("This lock has already been unlocked.")]
    AlreadyUnlocked,
    #[msg("Vault account does not match the lock record.")]
    VaultMismatch,
    #[msg("Vault balance is lower than the locked amount.")]
    InsufficientVaultBalance,
}

fn pad_project_name(name: &str) -> [u8; MAX_PROJECT_NAME_LEN] {
    let mut buffer = [0u8; MAX_PROJECT_NAME_LEN];
    let bytes = name.as_bytes();
    let len = bytes.len().min(MAX_PROJECT_NAME_LEN);
    buffer[..len].copy_from_slice(&bytes[..len]);
    buffer
}
