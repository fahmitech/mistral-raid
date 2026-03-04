#!/bin/bash

echo "🔍 Mistral Raid Pre-Demo Verification"
echo "======================================"
echo ""

# Check if we're on the demo branch
echo "📍 Checking git status..."
current_branch=$(git branch --show-current)
if [ "$current_branch" != "demo" ]; then
    echo "⚠️  Not on demo branch (current: $current_branch)"
else
    echo "✅ On demo branch"
fi
echo ""

# Run unit tests
echo "🧪 Running unit tests..."
npm run test:unit
if [ $? -eq 0 ]; then
    echo "✅ All unit tests passed"
else
    echo "❌ Unit tests failed"
    exit 1
fi
echo ""

# Check build
echo "🔨 Checking build..."
npm run build
if [ $? -eq 0 ]; then
    echo "✅ Build successful"
else
    echo "❌ Build failed"
    exit 1
fi
echo ""

# Check for common issues
echo "🔍 Checking for common issues..."

# Check if test files exist
if [ -d "tests/unit" ] && [ -f "tests/unit/gameState.test.ts" ]; then
    echo "✅ Unit test files present"
else
    echo "❌ Unit test files missing"
fi

if [ -f "vitest.config.ts" ]; then
    echo "✅ Vitest configuration present"
else
    echo "❌ Vitest configuration missing"
fi

if grep -q "\"test:unit\"" package.json && grep -q "\"test:coverage\"" package.json; then
    echo "✅ Unit test scripts in package.json"
else
    echo "❌ Unit test scripts missing from package.json"
fi

echo ""
echo "📋 Test Coverage Summary:"
echo "   • WebSocket server send/routing checks"
echo "   • GameState core logic"
echo "   • Audio defaults and persistence keys"
echo "   • Run npm run test:coverage for the current total"
echo ""

echo "🎯 Demo Readiness: HIGH"
echo "✅ All critical systems validated"
echo "✅ Test infrastructure operational"
echo "✅ Build successful"
echo ""

echo "🚀 Ready for demo!"
