#!/bin/bash

# Live Presence - Development Environment Setup Script
# This script installs all required dependencies for local development

set -e  # Exit on error

echo "🚀 Live Presence - Development Setup"
echo "===================================="
echo ""

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check OS
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
    OS="windows"
else
    OS="unknown"
fi

# ==============================================================================
# Java Setup
# ==============================================================================

echo -e "${BLUE}[1/5] Checking Java...${NC}"

# Check if Java 21 is installed
if command -v java &> /dev/null; then
    JAVA_VERSION=$(java -version 2>&1 | grep -oP '[0-9]+' | head -1)
    if [[ "$JAVA_VERSION" == "21" ]]; then
        echo -e "${GREEN}✓ Java 21 is already installed${NC}"
        java -version 2>&1 | head -1
    else
        echo -e "${YELLOW}⚠ Java $JAVA_VERSION found, but Java 21 is required${NC}"
        INSTALL_JAVA=1
    fi
else
    echo -e "${YELLOW}⚠ Java not found${NC}"
    INSTALL_JAVA=1
fi

# Offer to install Java if missing
if [[ "$INSTALL_JAVA" == "1" ]]; then
    echo ""
    read -p "Install Java 21 via SDKMAN? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}Installing SDKMAN...${NC}"
        
        # Check if SDKMAN is already installed
        if [[ ! -d "$HOME/.sdkman" ]]; then
            curl -s "https://get.sdkman.io" | bash
            source "$HOME/.sdkman/bin/sdkman-init.sh"
        else
            source "$HOME/.sdkman/bin/sdkman-init.sh"
        fi
        
        echo -e "${BLUE}Installing Java 21...${NC}"
        sdk install java 21.0.1-tem
        
        echo -e "${GREEN}✓ Java 21 installed successfully${NC}"
        java -version 2>&1 | head -1
    else
        echo -e "${YELLOW}Skipping Java installation. See JAVA_SETUP.md for manual installation.${NC}"
    fi
fi

echo ""

# ==============================================================================
# Docker Check
# ==============================================================================

echo -e "${BLUE}[2/5] Checking Docker...${NC}"

if command -v docker &> /dev/null; then
    echo -e "${GREEN}✓ Docker is installed${NC}"
    docker --version | head -1
else
    echo -e "${RED}✗ Docker not found${NC}"
    echo "Install Docker Desktop from: https://www.docker.com/products/docker-desktop"
    exit 1
fi

echo ""

# ==============================================================================
# Docker Compose Check
# ==============================================================================

echo -e "${BLUE}[3/5] Checking Docker Compose...${NC}"

if command -v docker-compose &> /dev/null; then
    echo -e "${GREEN}✓ Docker Compose is installed${NC}"
    docker-compose --version | head -1
elif docker compose version &> /dev/null 2>&1; then
    echo -e "${GREEN}✓ Docker Compose V2 is installed${NC}"
    docker compose version
else
    echo -e "${RED}✗ Docker Compose not found${NC}"
    echo "Install Docker Desktop (includes Compose) from: https://www.docker.com/products/docker-desktop"
    exit 1
fi

echo ""

# ==============================================================================
# Node.js Check (Optional)
# ==============================================================================

echo -e "${BLUE}[4/5] Checking Node.js (optional)...${NC}"

if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [[ "$NODE_VERSION" -ge 18 ]]; then
        echo -e "${GREEN}✓ Node.js is installed ($(node --version))${NC}"
    else
        echo -e "${YELLOW}⚠ Node.js $(node --version) found, but 18+ is recommended${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Node.js not found (optional for frontend development)${NC}"
fi

echo ""

# ==============================================================================
# Gradle Wrapper Check
# ==============================================================================

echo -e "${BLUE}[5/5] Verifying Gradle Wrapper...${NC}"

if [[ -f "backend/gradlew" ]]; then
    echo -e "${GREEN}✓ Gradle Wrapper found${NC}"
else
    echo -e "${RED}✗ Gradle Wrapper not found${NC}"
    exit 1
fi

echo ""

# ==============================================================================
# Summary & Next Steps
# ==============================================================================

echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}✓ Setup Complete!${NC}"
echo -e "${GREEN}================================${NC}"
echo ""

echo "📌 Next Steps:"
echo ""
echo "1. Start local development stack:"
echo -e "   ${YELLOW}make start-local${NC}"
echo ""
echo "2. In another terminal, run the backend:"
echo -e "   ${YELLOW}make run${NC}"
echo ""
echo "3. In another terminal, start the frontend:"
echo -e "   ${YELLOW}cd frontend && npm install && npm run dev${NC}"
echo ""

echo "🌐 Access points:"
echo -e "   Frontend:        ${BLUE}http://localhost:3000${NC}"
echo -e "   Backend API:     ${BLUE}http://localhost:8080${NC}"
echo -e "   Health Check:    ${BLUE}http://localhost:8080/actuator/health${NC}"
echo ""

echo "📚 Documentation:"
echo "   Java Setup:      ./JAVA_SETUP.md"
echo "   Full Guide:      ./LOCAL_DEVELOPMENT.md"
echo "   Quick Reference: ./QUICKSTART.md"
echo ""

echo "🆘 If you encounter issues:"
echo "   - Check JAVA_SETUP.md for Java troubleshooting"
echo "   - Check LOCAL_DEVELOPMENT.md for common issues"
echo "   - Run: make check-java"
echo ""
