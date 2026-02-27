#!/usr/bin/env rust-script
//! ```cargo
//! [dependencies]
//! clap = { version = "4", features = ["derive", "env"] }
//! postgres = "0.19"
//! redis = "0.27"
//! which = "7"
//! ```

use clap::{Parser, Subcommand};
use std::fs;
use std::process::{exit, Command};

#[derive(Parser)]
#[command(name = "db", about = "Manage PostgreSQL and Redis for development")]
struct Cli {
    #[command(subcommand)]
    command: Cmd,
}

#[derive(Subcommand)]
enum Cmd {
    /// Manage PostgreSQL
    Pg(PgArgs),
    /// Manage Redis
    Redis(RedisArgs),
    /// Start PostgreSQL and Redis
    Up(DbConfig),
    /// Stop PostgreSQL and Redis
    Down(DbConfig),
    /// Wipe data and reinitialize
    Reset(DbConfig),
}

#[derive(Parser)]
struct PgArgs {
    #[command(subcommand)]
    command: PgCmd,
}

#[derive(Subcommand)]
enum PgCmd {
    /// Initialize data directory (first time only)
    Init(DbConfig),
    /// Start PostgreSQL
    Start(DbConfig),
    /// Stop PostgreSQL
    Stop(DbConfig),
    /// Show connection status
    Status(DbConfig),
    /// Check connection (exits non-zero if not reachable)
    Check(DbConfig),
}

#[derive(Parser)]
struct RedisArgs {
    #[command(subcommand)]
    command: RedisCmd,
}

#[derive(Subcommand)]
enum RedisCmd {
    /// Start Redis
    Start(DbConfig),
    /// Stop Redis
    Stop(DbConfig),
    /// Show connection status
    Status(DbConfig),
    /// Check connection (exits non-zero if not reachable)
    Check(DbConfig),
}

#[derive(Parser, Clone)]
struct DbConfig {
    #[arg(long, env = "PGDATA", default_value = ".dev-data/postgres")]
    pg_data: String,

    #[arg(long, env = "DATABASE_HOST", default_value = "localhost")]
    pg_host: String,

    #[arg(long, env = "DATABASE_PORT", default_value = "5432")]
    pg_port: String,

    #[arg(long, env = "POSTGRES_USER", default_value = "sub2api")]
    pg_user: String,

    #[arg(long, env = "POSTGRES_PASSWORD", default_value = "")]
    pg_password: String,

    #[arg(long, env = "POSTGRES_DB", default_value = "sub2api")]
    pg_db: String,

    #[arg(long, env = "REDIS_HOST", default_value = "localhost")]
    redis_host: String,

    #[arg(long, env = "REDIS_PORT", default_value = "6379")]
    redis_port: String,

    #[arg(long, env = "REDIS_PASSWORD", default_value = "")]
    redis_password: String,

    #[arg(long, env = "REDIS_DIR", default_value = ".dev-data/redis")]
    redis_dir: String,
}

fn find(program: &str) -> std::path::PathBuf {
    which::which(program).unwrap_or_else(|_| {
        eprintln!("✗ '{}' not found in PATH", program);
        exit(1);
    })
}

fn run(program: &str, args: &[&str]) -> bool {
    let bin = find(program);
    match Command::new(&bin).args(args).status() {
        Ok(s) => s.success(),
        Err(e) => {
            eprintln!("  failed to execute {} ({}): {}", program, bin.display(), e);
            false
        }
    }
}

// ── Process management (external commands) ───────────────────────────────────

fn pg_init(cfg: &DbConfig) {
    let marker = format!("{}/PG_VERSION", cfg.pg_data);
    if std::path::Path::new(&marker).exists() {
        println!("✓ PostgreSQL data directory already initialized, skipping");
        return;
    }
    println!("📦 Initializing PostgreSQL data directory...");
    if let Some(parent) = std::path::Path::new(&cfg.pg_data).parent() {
        fs::create_dir_all(parent).expect("failed to create parent directory");
    }
    let pwfile = format!("{}/../.pgpass_init", cfg.pg_data);
    fs::write(&pwfile, &cfg.pg_password).expect("failed to write pwfile");
    let ok = run("initdb", &["-D", &cfg.pg_data, "-U", &cfg.pg_user, "--pwfile", &pwfile, "--auth", "md5"]);
    fs::remove_file(&pwfile).ok();
    if !ok { eprintln!("✗ initdb failed"); exit(1); }
    println!("✓ PostgreSQL initialized at {}", cfg.pg_data);
}

fn pg_start(cfg: &DbConfig) {
    println!("📦 Starting PostgreSQL...");
    let opts = format!("-p {}", cfg.pg_port);
    let log = format!("{}/postgres.log", cfg.pg_data);
    if !run("pg_ctl", &["start", "-D", &cfg.pg_data, "-o", &opts, "-l", &log]) {
        eprintln!("✗ PostgreSQL failed to start"); exit(1);
    }
    println!("✓ PostgreSQL started on {}:{}", cfg.pg_host, cfg.pg_port);
}

fn pg_read_pid(cfg: &DbConfig) -> Option<u32> {
    let pidfile = format!("{}/postmaster.pid", cfg.pg_data);
    fs::read_to_string(&pidfile).ok()
        .and_then(|s| s.lines().next().and_then(|l| l.trim().parse().ok()))
}

fn pg_stop(cfg: &DbConfig) {
    if pg_read_pid(cfg).is_none() {
        println!("⚠️  PostgreSQL not running, skipping");
        return;
    }
    println!("⛔ Stopping PostgreSQL...");
    if run("pg_ctl", &["stop", "-D", &cfg.pg_data, "-m", "fast"]) {
        println!("✓ PostgreSQL stopped");
        return;
    }
    // pg_ctl stop failed (e.g. single-user mode) — send KILL signal via pg_ctl
    if let Some(pid) = pg_read_pid(cfg) {
        eprintln!("  pg_ctl stop failed, sending KILL to PID {}...", pid);
        run("pg_ctl", &["kill", "KILL", &pid.to_string()]);
        std::thread::sleep(std::time::Duration::from_secs(1));
    }
    println!("✓ PostgreSQL stopped");
}

fn redis_start(cfg: &DbConfig) {
    println!("📦 Starting Redis...");
    fs::create_dir_all(&cfg.redis_dir).expect("failed to create redis dir");
    let abs_dir = std::path::Path::new(&cfg.redis_dir).canonicalize()
        .unwrap_or_else(|_| std::path::PathBuf::from(&cfg.redis_dir));
    // Strip Windows UNC prefix (\\?\) which redis-server doesn't understand
    let dir_s = abs_dir.to_string_lossy().replace("\\\\?\\", "");
    let log_s = format!("{}/redis.log", dir_s);
    let pid_s = format!("{}/redis.pid", dir_s);
    let bin = find("redis-server");
    let out = Command::new(&bin)
        .args(["--port", &cfg.redis_port, "--daemonize", "yes",
               "--logfile", &log_s, "--pidfile", &pid_s, "--dir", &dir_s])
        .output();
    match out {
        Ok(o) if o.status.success() => {
            println!("✓ Redis started on {}:{}", cfg.redis_host, cfg.redis_port);
        }
        Ok(o) => {
            let stderr = String::from_utf8_lossy(&o.stderr);
            let stdout = String::from_utf8_lossy(&o.stdout);
            eprintln!("✗ Redis failed to start (exit {})", o.status);
            if !stderr.is_empty() { eprintln!("  stderr: {}", stderr.trim()); }
            if !stdout.is_empty() { eprintln!("  stdout: {}", stdout.trim()); }
            exit(1);
        }
        Err(e) => {
            eprintln!("✗ Failed to execute redis-server: {}", e);
            exit(1);
        }
    }
}

fn redis_stop(cfg: &DbConfig) {
    if redis_connect(cfg).is_err() {
        println!("⚠️  Redis not running, skipping");
        return;
    }
    println!("⛔ Stopping Redis...");
    run("redis-cli", &["-h", &cfg.redis_host, "-p", &cfg.redis_port, "shutdown", "nosave"]);
    println!("✓ Redis stopped");
}

// ── Connection checks (native crates) ────────────────────────────────────────

fn pg_connect(cfg: &DbConfig) -> Result<(), String> {
    // Connect to 'postgres' maintenance DB for health checks;
    // the application DB may not exist until db-install runs.
    let url = format!(
        "host={} port={} user={} password={} dbname=postgres connect_timeout=3",
        cfg.pg_host, cfg.pg_port, cfg.pg_user, cfg.pg_password
    );
    postgres::Client::connect(&url, postgres::NoTls)
        .map(|_| ())
        .map_err(|e| e.to_string())
}

fn redis_connect(cfg: &DbConfig) -> Result<(), String> {
    let url = if cfg.redis_password.is_empty() {
        format!("redis://{}:{}", cfg.redis_host, cfg.redis_port)
    } else {
        format!("redis://:{}@{}:{}", cfg.redis_password, cfg.redis_host, cfg.redis_port)
    };
    let client = redis::Client::open(url).map_err(|e| e.to_string())?;
    let mut con = client.get_connection_with_timeout(std::time::Duration::from_secs(3))
        .map_err(|e| e.to_string())?;
    redis::cmd("PING").exec(&mut con).map_err(|e| e.to_string())
}

fn pg_status(cfg: &DbConfig) {
    print!("📊 PostgreSQL {}:{}/{} ... ", cfg.pg_host, cfg.pg_port, cfg.pg_db);
    match pg_connect(cfg) {
        Ok(_)  => println!("running ✓"),
        Err(e) => println!("stopped ✗  ({})", e),
    }
}

fn pg_check(cfg: &DbConfig) {
    match pg_connect(cfg) {
        Ok(_)  => println!("✓ PostgreSQL {}:{}/{} is running", cfg.pg_host, cfg.pg_port, cfg.pg_db),
        Err(e) => { eprintln!("✗ PostgreSQL {}:{}/{}: {}", cfg.pg_host, cfg.pg_port, cfg.pg_db, e); exit(1); }
    }
}

fn redis_status(cfg: &DbConfig) {
    print!("💾 Redis {}:{} ... ", cfg.redis_host, cfg.redis_port);
    match redis_connect(cfg) {
        Ok(_)  => println!("running ✓"),
        Err(e) => println!("stopped ✗  ({})", e),
    }
}

fn redis_check(cfg: &DbConfig) {
    match redis_connect(cfg) {
        Ok(_)  => println!("✓ Redis {}:{} is running", cfg.redis_host, cfg.redis_port),
        Err(e) => { eprintln!("✗ Redis {}:{}: {}", cfg.redis_host, cfg.redis_port, e); exit(1); }
    }
}

fn main() {
    let cli = Cli::parse();

    match cli.command {
        Cmd::Pg(args) => match args.command {
            PgCmd::Init(cfg)   => pg_init(&cfg),
            PgCmd::Start(cfg)  => pg_start(&cfg),
            PgCmd::Stop(cfg)   => pg_stop(&cfg),
            PgCmd::Status(cfg) => pg_status(&cfg),
            PgCmd::Check(cfg)  => pg_check(&cfg),
        },
        Cmd::Redis(args) => match args.command {
            RedisCmd::Start(cfg)  => redis_start(&cfg),
            RedisCmd::Stop(cfg)   => redis_stop(&cfg),
            RedisCmd::Status(cfg) => redis_status(&cfg),
            RedisCmd::Check(cfg)  => redis_check(&cfg),
        },
        Cmd::Up(cfg) => {
            pg_start(&cfg);
            redis_start(&cfg);
        }
        Cmd::Down(cfg) => {
            pg_stop(&cfg);
            redis_stop(&cfg);
        }
        Cmd::Reset(cfg) => {
            pg_stop(&cfg);
            redis_stop(&cfg);
            println!("🗑️  Cleaning data...");
            fs::remove_dir_all(&cfg.pg_data).ok();
            fs::remove_dir_all(&cfg.redis_dir).ok();
            pg_init(&cfg);
            pg_start(&cfg);
            redis_start(&cfg);
            println!("✅ Reset complete!");
        }
    }
}
