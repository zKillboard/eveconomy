#!/bin/bash

# EVE Economy Market Groups Updater Shell Script
# Provides convenient commands for updating and validating market groups

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if Node.js is available
check_nodejs() {
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed or not in PATH"
        exit 1
    fi
    
    NODE_VERSION=$(node --version)
    print_status "Using Node.js $NODE_VERSION"
}

# Function to ensure directories exist
setup_directories() {
    mkdir -p docs/api
    mkdir -p temp
    print_status "Directories checked/created"
}

# Function to create backup
create_backup() {
    if [ -f "docs/api/groups.json" ]; then
        BACKUP_FILE="docs/api/groups.json.backup.$(date +%Y%m%d_%H%M%S)"
        cp "docs/api/groups.json" "$BACKUP_FILE"
        print_success "Backup created: $BACKUP_FILE"
    else
        print_warning "No existing groups.json file to backup"
    fi
}

# Function to validate current groups.json
validate() {
    print_status "Validating market groups..."
    if node validate_market_groups.js; then
        print_success "Validation passed!"
        return 0
    else
        print_error "Validation failed!"
        return 1
    fi
}

# Function to run basic update
update_basic() {
    print_status "Running basic market groups update..."
    node populate_market_groups.js
}

# Function to run enhanced update
update_enhanced() {
    local args=""
    local skip_backup=false
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -v|--verbose)
                args="$args --verbose"
                shift
                ;;
            --no-backup)
                args="$args --no-backup"
                skip_backup=true
                shift
                ;;
            --no-cache)
                args="$args --no-cache"
                shift
                ;;
            --rate-limit)
                args="$args --rate-limit $2"
                shift 2
                ;;
            *)
                print_warning "Unknown option: $1"
                shift
                ;;
        esac
    done
    
    # Create backup unless --no-backup was specified
    if [ "$skip_backup" = false ]; then
        create_backup
    else
        print_status "Skipping backup creation (--no-backup specified)"
    fi
    
    print_status "Running enhanced market groups update with args: $args"
    node update_market_groups.js $args
}

# Function to show file statistics
show_stats() {
    if [ -f "docs/api/groups.json" ]; then
        local file_size=$(stat -f%z "docs/api/groups.json" 2>/dev/null || stat -c%s "docs/api/groups.json" 2>/dev/null)
        local file_size_mb=$(echo "scale=2; $file_size / 1024 / 1024" | bc -l 2>/dev/null || echo "N/A")
        local mod_time=$(stat -f%Sm "docs/api/groups.json" 2>/dev/null || stat -c%y "docs/api/groups.json" 2>/dev/null)
        
        echo -e "${BLUE}📊 groups.json Statistics:${NC}"
        echo "   File Size: ${file_size_mb} MB"
        echo "   Last Modified: $mod_time"
        echo "   Location: $(pwd)/docs/api/groups.json"
        
        # Show JSON structure summary if jq is available
        if command -v jq &> /dev/null; then
            local root_groups=$(jq 'keys | length' docs/api/groups.json)
            echo "   Root Categories: $root_groups"
        fi
    else
        print_warning "groups.json file not found"
    fi
}

# Function to clean temporary files
clean() {
    print_status "Cleaning temporary files..."
    
    if [ -f "temp/market_groups_cache.json" ]; then
        rm "temp/market_groups_cache.json"
        print_success "Cache file removed"
    fi
    
    # Clean old backups (keep last 5)
    if ls docs/api/groups.json.backup.* &> /dev/null; then
        ls -t docs/api/groups.json.backup.* | tail -n +6 | xargs -r rm
        print_success "Old backups cleaned"
    fi
}

# Function to show usage
show_usage() {
    cat << EOF
EVE Economy Market Groups Updater

Usage: $0 <command> [options]

Commands:
    update          Run enhanced market groups update
    update-basic    Run basic market groups update  
    validate        Validate current groups.json file
    stats           Show file statistics
    backup          Create manual backup
    clean           Clean temporary files and old backups
    help            Show this help message

Update Options:
    -v, --verbose       Enable verbose logging
    --no-backup        Don't create backup before update
    --no-cache         Don't use cache, fetch fresh data
    --rate-limit N     Set rate limit to N requests per second

Examples:
    $0 update                    # Standard update
    $0 update --verbose          # Update with verbose output
    $0 update --rate-limit 100   # Update with custom rate limit
    $0 validate                  # Validate current file
    $0 clean                     # Clean temporary files

Files:
    docs/api/groups.json                 - Main output file
    docs/api/groups.json.backup.*        - Backup files
    temp/market_groups_cache.json        - Cache file

EOF
}

# Main script logic
main() {
    if [ $# -eq 0 ]; then
        show_usage
        exit 1
    fi
    
    # Setup
    check_nodejs
    setup_directories
    
    case "$1" in
        "update")
            shift
            update_enhanced "$@"
            print_success "Update completed!"
            validate
            show_stats
            ;;
        "update-basic")
            create_backup
            update_basic
            print_success "Basic update completed!"
            validate
            show_stats
            ;;
        "validate")
            validate
            ;;
        "stats")
            show_stats
            ;;
        "backup")
            create_backup
            ;;
        "clean")
            clean
            ;;
        "help"|"-h"|"--help")
            show_usage
            ;;
        *)
            print_error "Unknown command: $1"
            show_usage
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"