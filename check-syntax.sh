#!/bin/bash

# Quick Syntax Check Script for Rocket.Chat
# Run this before committing to catch TypeScript errors early
# This script does NOT install dependencies - it just checks syntax

set -e

echo "========================================"
echo "  Quick TypeScript Syntax Check"
echo "========================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: Must be run from the Rocket.Chat root directory${NC}"
    exit 1
fi

echo -e "${YELLOW}Checking for common TypeScript errors...${NC}"
echo ""

# Check for unused variables (the most common issue)
ERRORS_FOUND=0

echo "Checking ee/packages/license/src/license.ts..."

# Check for declared but never read errors
if grep -n "private _[a-zA-Z]*\|private [a-zA-Z]*(" ee/packages/license/src/license.ts | grep -v "private _license\|private _unmodifiedLicense\|private _valid\|private _lockedLicense\|private workspaceUrl\|private states" > /tmp/unused_check.txt 2>/dev/null; then
    if [ -s /tmp/unused_check.txt ]; then
        echo -e "${YELLOW}  Warning: Found potentially unused private methods:${NC}"
        cat /tmp/unused_check.txt
        echo ""
    fi
fi

# Check for unused imports
echo "Checking for unused imports..."
UNUSED_IMPORTS=""

# Check specific imports that have caused issues
if grep -q "import.*getLicenseLimit.*from" ee/packages/license/src/license.ts 2>/dev/null; then
    if ! grep -q "getLicenseLimit\(" ee/packages/license/src/license.ts 2>/dev/null; then
        UNUSED_IMPORTS="${UNUSED_IMPORTS}getLicenseLimit "
    fi
fi

if grep -q "import.*behaviorTriggeredToggled.*from" ee/packages/license/src/license.ts 2>/dev/null; then
    if ! grep -q "behaviorTriggeredToggled\(" ee/packages/license/src/license.ts 2>/dev/null; then
        UNUSED_IMPORTS="${UNUSED_IMPORTS}behaviorTriggeredToggled "
    fi
fi

if [ -n "$UNUSED_IMPORTS" ]; then
    echo -e "${RED}  Error: Found unused imports: ${UNUSED_IMPORTS}${NC}"
    ERRORS_FOUND=1
fi

# Check for underscore-prefixed unused methods that TypeScript still complains about
echo "Checking for problematic underscore-prefixed methods..."
if grep -q "_triggerBehaviorEventsToggled\|_consolidateBehaviorState" ee/packages/license/src/license.ts 2>/dev/null; then
    echo -e "${RED}  Error: Found underscore-prefixed methods that should be removed:${NC}"
    grep -n "_triggerBehaviorEventsToggled\|_consolidateBehaviorState" ee/packages/license/src/license.ts
    ERRORS_FOUND=1
fi

# Check modules.ts
echo "Checking ee/packages/license/src/modules.ts..."
if grep -q "function hasModule.*module:" ee/packages/license/src/modules.ts 2>/dev/null; then
    if ! grep -q "function hasModule.*_module:" ee/packages/license/src/modules.ts 2>/dev/null; then
        echo -e "${YELLOW}  Warning: hasModule parameter 'module' should be '_module' to indicate unused${NC}"
    fi
fi

echo ""

if [ $ERRORS_FOUND -eq 1 ]; then
    echo "========================================"
    echo -e "${RED}  Errors found! Fix before pushing.${NC}"
    echo "========================================"
    exit 1
else
    echo "========================================"
    echo -e "${GREEN}  Quick check passed!${NC}"
    echo "========================================"
    echo ""
    echo "Note: This is a quick check. Full TypeScript compilation"
    echo "happens during the GitHub Action build."
fi
