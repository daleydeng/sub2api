// install is a CLI tool for first-time setup.
// It reads configuration from environment variables (compatible with deploy/.env)
// and calls setup.Install() directly without requiring a running HTTP server.
//
// Usage:
//
//	go run ./backend/cmd/install
//
// Required env vars (same as deploy/.env):
//
//	POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB, DATABASE_PORT
//	REDIS_PORT, REDIS_PASSWORD
//	ADMIN_EMAIL, ADMIN_PASSWORD
package main

import (
	"fmt"
	"os"
	"strconv"

	"github.com/Wei-Shaw/sub2api/internal/setup"
)

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getenvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			return i
		}
	}
	return fallback
}

func main() {
	cfg := &setup.SetupConfig{
		Database: setup.DatabaseConfig{
			Host:     getenv("DATABASE_HOST", "localhost"),
			Port:     getenvInt("DATABASE_PORT", 5432),
			User:     getenv("POSTGRES_USER", "sub2api"),
			Password: getenv("POSTGRES_PASSWORD", ""),
			DBName:   getenv("POSTGRES_DB", "sub2api"),
			SSLMode:  getenv("DATABASE_SSLMODE", "disable"),
		},
		Redis: setup.RedisConfig{
			Host:      getenv("REDIS_HOST", "localhost"),
			Port:      getenvInt("REDIS_PORT", 6379),
			Password:  getenv("REDIS_PASSWORD", ""),
			DB:        getenvInt("REDIS_DB", 0),
			EnableTLS: getenv("REDIS_ENABLE_TLS", "false") == "true",
		},
		Admin: setup.AdminConfig{
			Email:    getenv("ADMIN_EMAIL", "admin@sub2api.local"),
			Password: getenv("ADMIN_PASSWORD", ""),
		},
		Server: setup.ServerConfig{
			Host: getenv("SERVER_HOST", "0.0.0.0"),
			Port: getenvInt("SERVER_PORT", 8080),
			Mode: getenv("SERVER_MODE", "debug"),
		},
		JWT: setup.JWTConfig{
			Secret:     getenv("JWT_SECRET", ""),
			ExpireHour: getenvInt("JWT_EXPIRE_HOUR", 24),
		},
	}

	if err := setup.Install(cfg); err != nil {
		fmt.Fprintf(os.Stderr, "install failed: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("Installation completed successfully.")
}
