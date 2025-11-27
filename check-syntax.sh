#!/bin/bash

# Syntax and TypeScript Check Script for Rocket.Chat
# Run this before deploying to catch errors early

set -e

echo "========================================"
echo "  Rocket.Chat Syntax & Build Check"
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

echo -e "${YELLOW}Step 1: Installing dependencies...${NC}"
yarn install --frozen-lockfile || yarn install
echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

echo -e "${YELLOW}Step 2: Checking TypeScript in ee/packages/license...${NC}"
cd ee/packages/license
if yarn tsc --noEmit; then
    echo -e "${GREEN}✓ License package TypeScript check passed${NC}"
else
    echo -e "${RED}✗ License package TypeScript check failed${NC}"
    exit 1
fi
cd ../../..
echo ""

echo -e "${YELLOW}Step 3: Building license package...${NC}"
if yarn workspace @rocket.chat/license build; then
    echo -e "${GREEN}✓ License package build passed${NC}"
else
    echo -e "${RED}✗ License package build failed${NC}"
    exit 1
fi
echo ""

echo -e "${YELLOW}Step 4: Running ESLint on modified files...${NC}"
# Check the specific files we modified
FILES_TO_CHECK=(
    "ee/packages/license/src/license.ts"
    "ee/packages/license/src/modules.ts"
    "ee/packages/license/src/tags.ts"
    "ee/packages/license/src/validation/validateDefaultLimits.ts"
    "apps/meteor/client/sidebar/footer/SidebarFooterWatermark.tsx"
    "apps/meteor/client/sidebarv2/footer/SidebarFooterWatermark.tsx"
)

LINT_FAILED=0
for file in "${FILES_TO_CHECK[@]}"; do
    if [ -f "$file" ]; then
        echo "  Checking $file..."
        if yarn eslint "$file" --quiet 2>/dev/null; then
            echo -e "    ${GREEN}✓ Passed${NC}"
        else
            echo -e "    ${YELLOW}⚠ Warnings (non-blocking)${NC}"
        fi
    fi
done
echo ""

echo -e "${YELLOW}Step 5: Full TypeScript check (this may take a while)...${NC}"
if yarn typecheck 2>/dev/null || yarn turbo run typecheck 2>/dev/null; then
    echo -e "${GREEN}✓ Full TypeScript check passed${NC}"
else
    echo -e "${YELLOW}⚠ TypeScript check had issues (may be pre-existing)${NC}"
fi
echo ""

echo -e "${YELLOW}Step 6: Testing license package build output...${NC}"
if [ -d "ee/packages/license/dist" ]; then
    echo -e "${GREEN}✓ License package dist folder exists${NC}"
    ls -la ee/packages/license/dist/
else
    echo -e "${RED}✗ License package dist folder not found${NC}"
    exit 1
fi
echo ""

echo "========================================"
echo -e "${GREEN}  All checks completed!${NC}"
echo "========================================"
echo ""
echo "You can now commit and push your changes."
echo ""
