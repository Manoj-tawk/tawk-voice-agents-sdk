#!/bin/bash

# Tawk Agents SDK - Complete Test Suite with Langfuse Tracing
# This script runs all tests with full tracing

echo "🧪 Tawk Agents SDK - Complete Test Suite"
echo ""
echo "Setting up environment..."
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found!"
    echo ""
    echo "Please create a .env file with your API keys:"
    echo ""
    echo "# Required"
    echo "OPENAI_API_KEY=your-key-here"
    echo ""
    echo "# Optional (for multi-provider tests)"
    echo "GOOGLE_GENERATIVE_AI_API_KEY=your-key-here"
    echo ""
    echo "# Optional (for Langfuse tracing)"
    echo "LANGFUSE_SECRET_KEY=sk-lf-..."
    echo "LANGFUSE_PUBLIC_KEY=pk-lf-..."
    echo "LANGFUSE_BASE_URL=https://us.cloud.langfuse.com"
    echo ""
    exit 1
fi

# Run tests
echo "✅ Found .env file"
echo "🚀 Running tests..."
echo ""

npm test

echo ""
echo "✅ Tests complete!"
echo ""
echo "📊 View your Langfuse traces:"
echo "   https://us.cloud.langfuse.com"
echo ""

