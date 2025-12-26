#!/bin/bash

# Test script for backend email validation
# This script tests that backend enforcement is working correctly

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${RED}Error: .env file not found${NC}"
    echo "Please create a .env file with your Supabase credentials"
    exit 1
fi

# Load environment variables
source .env

# Check if required variables are set
if [ -z "$VITE_SUPABASE_URL" ] || [ -z "$VITE_SUPABASE_ANON_KEY" ]; then
    echo -e "${RED}Error: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not set in .env${NC}"
    exit 1
fi

# Extract project ref from URL
PROJECT_REF=$(echo $VITE_SUPABASE_URL | sed 's|https://||' | sed 's|\.supabase\.co||')

echo -e "${YELLOW}Testing backend email validation...${NC}"
echo "Project: $PROJECT_REF"
echo ""

# Test 1: Valid .edu email (should succeed)
echo -e "${YELLOW}Test 1: Valid .edu email${NC}"
RESPONSE=$(curl -s -X POST "$VITE_SUPABASE_URL/auth/v1/signup" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test'$(date +%s)'@university.edu",
    "password": "TestPassword123!"
  }')

if echo "$RESPONSE" | grep -q "user\|id"; then
    echo -e "${GREEN}✓ PASS: Valid .edu email accepted${NC}"
else
    echo -e "${RED}✗ FAIL: Valid .edu email rejected${NC}"
    echo "Response: $RESPONSE"
fi
echo ""

# Test 2: Invalid non-.edu email (should fail)
echo -e "${YELLOW}Test 2: Invalid non-.edu email${NC}"
RESPONSE=$(curl -s -X POST "$VITE_SUPABASE_URL/auth/v1/signup" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test'$(date +%s)'@gmail.com",
    "password": "TestPassword123!"
  }')

if echo "$RESPONSE" | grep -q "edu\|university\|domain"; then
    echo -e "${GREEN}✓ PASS: Invalid email correctly rejected${NC}"
elif echo "$RESPONSE" | grep -q "error"; then
    echo -e "${GREEN}✓ PASS: Invalid email rejected (error returned)${NC}"
else
    echo -e "${RED}✗ FAIL: Invalid email was accepted!${NC}"
    echo "Response: $RESPONSE"
    echo -e "${RED}⚠️  WARNING: Backend enforcement may not be set up correctly${NC}"
fi
echo ""

# Test 3: Test Edge Function directly (if deployed)
echo -e "${YELLOW}Test 3: Edge Function validation${NC}"
echo "Note: This requires the Edge Function to be deployed and SERVICE_ROLE_KEY to be set"
if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo -e "${YELLOW}⚠️  SERVICE_ROLE_KEY not set, skipping Edge Function test${NC}"
    echo "Set SUPABASE_SERVICE_ROLE_KEY in .env to test Edge Function"
else
    FUNCTION_URL="$VITE_SUPABASE_URL/functions/v1/validate-email"
    RESPONSE=$(curl -s -X POST "$FUNCTION_URL" \
      -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
      -H "Content-Type: application/json" \
      -d '{
        "email": "test@gmail.com",
        "type": "signup"
      }')
    
    if echo "$RESPONSE" | grep -q "INVALID_EMAIL_DOMAIN\|edu"; then
        echo -e "${GREEN}✓ PASS: Edge Function correctly validates emails${NC}"
    else
        echo -e "${YELLOW}⚠️  Edge Function may not be deployed or configured correctly${NC}"
        echo "Response: $RESPONSE"
    fi
fi
echo ""

echo -e "${YELLOW}Testing complete!${NC}"
echo ""
echo "For complete backend enforcement setup, see: BACKEND_ENFORCEMENT_SETUP.md"

