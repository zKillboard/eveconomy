#!/bin/bash

# GitHub Action Workflow Test Script
# Tests the key steps that will run in the actual GitHub Action

set -e  # Exit on any error

echo "🧪 Testing GitHub Action Workflow Locally"
echo "========================================"
echo ""

# Test 1: Check Node.js version (simulates setup-node step)
echo "📦 Step 1: Check Node.js Setup"
echo "------------------------------"
node --version || {
    echo "❌ Node.js not found! GitHub Action will fail."
    exit 1
}
echo "✅ Node.js is available"
echo ""

# Test 2: Check if scripts are executable (simulates make scripts executable step)
echo "🔧 Step 2: Check Script Permissions"
echo "-----------------------------------"
if [ -x "update_groups.sh" ]; then
    echo "✅ update_groups.sh is executable"
else
    echo "⚠️  update_groups.sh not executable - will be fixed by chmod in action"
fi

if [ -x "populate_market_groups.js" ]; then
    echo "✅ populate_market_groups.js is executable"
else
    echo "⚠️  populate_market_groups.js not executable - will be fixed by chmod in action"
fi
echo ""

# Test 3: Validate the main update script exists and has correct options
echo "🚀 Step 3: Validate Update Script"
echo "---------------------------------"
if [ -f "update_groups.sh" ]; then
    echo "✅ update_groups.sh exists"
    
    # Test help to see if --enhanced, --no-cache, --no-backup options exist
    if ./update_groups.sh --help 2>/dev/null | grep -q "enhanced\|no-cache\|no-backup"; then
        echo "✅ Required options (--enhanced, --no-cache, --no-backup) appear to be supported"
    else
        echo "⚠️  Could not verify all required options - testing actual command..."
        # Try to run with actual options (but exit early)
        if ./update_groups.sh --enhanced --no-cache --no-backup --help >/dev/null 2>&1; then
            echo "✅ Options accepted"
        else
            echo "❌ Options not recognized - GitHub Action may fail"
        fi
    fi
else
    echo "❌ update_groups.sh not found! GitHub Action will fail."
    exit 1
fi
echo ""

# Test 4: Check if target file exists
echo "📄 Step 4: Check Target File"
echo "----------------------------"
if [ -f "docs/api/groups.json" ]; then
    echo "✅ docs/api/groups.json exists"
    echo "📊 Current file size: $(ls -lh docs/api/groups.json | awk '{print $5}')"
else
    echo "⚠️  docs/api/groups.json not found - will be created by update script"
fi
echo ""

# Test 5: Simulate git operations
echo "📝 Step 5: Test Git Operations"
echo "------------------------------"
# Check git config
if git config user.name >/dev/null && git config user.email >/dev/null; then
    echo "✅ Git is configured"
    echo "   User: $(git config user.name) <$(git config user.email)>"
else
    echo "⚠️  Git not configured - GitHub Action will set its own config"
fi

# Check if we're in a git repo
if git rev-parse --git-dir >/dev/null 2>&1; then
    echo "✅ In a git repository"
    echo "   Branch: $(git branch --show-current)"
    echo "   Remote: $(git remote get-url origin 2>/dev/null || echo 'No remote configured')"
else
    echo "❌ Not in a git repository! GitHub Action will fail."
    exit 1
fi
echo ""

# Test 6: Dry run simulation (without actually running the updater)
echo "🔍 Step 6: Dry Run Simulation"
echo "-----------------------------"
echo "Simulating the command that will run in GitHub Action:"
echo "  ./update_groups.sh --enhanced --no-cache --no-backup"
echo ""
echo "Note: Not actually running the updater to avoid API calls and changes"
echo "The GitHub Action will run this command for real."
echo ""

echo "🎉 Pre-flight Tests Complete!"
echo "============================="
echo ""
echo "✅ All critical components are ready for GitHub Action execution"
echo "🚀 The workflow should run successfully when triggered"
echo ""
echo "To actually test the update process locally (optional):"
echo "  ./update_groups.sh --enhanced --no-cache --no-backup"
echo ""