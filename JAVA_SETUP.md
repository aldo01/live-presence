# Java Setup Guide

## Java Requirements

This project uses **Java 21** (LTS - Long Term Support).

### Why Java 21?
- Virtual Threads (Project Loom) - better async handling
- Pattern Matching - cleaner code
- Record Classes - immutable data structures
- Modern Spring Boot 3.3.5 support

---

## Installation

### Option 1: Using SDK Manager (Recommended)

**Install SDKMAN!** (cross-platform):
```bash
# macOS / Linux
curl -s "https://get.sdkman.io" | bash

# Windows (WSL or Git Bash)
curl -s "https://get.sdkman.io" | bash
```

**Install Java 21**:
```bash
sdk install java 21.0.1-tem
```

**Set as default** (optional):
```bash
sdk default java 21.0.1-tem
```

**Verify installation**:
```bash
java -version
# Expected: openjdk version "21.0.1" 2023-10-17
```

---

### Option 2: Direct Installation

#### macOS
```bash
# Using Homebrew
brew install openjdk@21

# Verify
/opt/homebrew/opt/openjdk@21/bin/java -version

# Or add to PATH in ~/.zshrc:
export PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH"
```

#### Ubuntu/Debian
```bash
sudo apt-get update
sudo apt-get install openjdk-21-jdk

# Verify
java -version
```

#### Windows
1. Download from [Adoptium](https://adoptium.net/) or [Oracle](https://www.oracle.com/java/technologies/downloads/)
2. Run installer
3. Verify in PowerShell:
   ```powershell
   java -version
   ```

#### Docker (No Local Installation)
```bash
# Build and run in container
docker build -f backend/Dockerfile -t live-presence-backend:latest ./backend
docker run -p 8080:8080 live-presence-backend:latest
```

---

## Configuration

### Environment Variables

**Linux / macOS** - Add to `~/.bash_profile`, `~/.zshrc`, or `.env`:
```bash
export JAVA_HOME=$(sdk home java 21.0.1-tem)  # or your JDK path
export PATH=$JAVA_HOME/bin:$PATH
export _JAVA_OPTIONS="-Xmx1024m -Xms512m"   # Heap size (optional)
```

**Windows** - Set System Environment Variables:
```
JAVA_HOME = C:\Program Files\Java\jdk-21
PATH = %JAVA_HOME%\bin;[existing PATH]
```

**Verify**:
```bash
echo $JAVA_HOME
java -version
javac -version
```

---

## IDE Setup

### VS Code
1. **Install Extension Pack for Java** (Microsoft)
   - Provides Java language support
   - Debugging
   - Maven/Gradle support

2. **Install Extension for Gradle** (Microsoft)

3. **Configure in `.vscode/settings.json`**:
   ```json
   {
     "java.jdt.ls.vmargs": "-XX:+UseParallelGC -XX:GCTimeRatio=4 -XX:AdaptiveSizePolicyWeight=90 -Dsun.zip.disableMemoryMapping=true -Xmx1G -Xms100m -Drestart.disabled=true",
     "java.home": "/path/to/java/21",
     "java.configuration.runtimes": [
       {
         "name": "JavaSE-21",
         "path": "/path/to/java/21"
       }
     ]
   }
   ```

### IntelliJ IDEA
1. **File** → **Project Structure** → **SDKs**
2. Click **+** → Select **JDK**
3. Navigate to Java 21 installation directory
4. Click **OK**

### Eclipse
1. **Window** → **Preferences** → **Java** → **Installed JREs**
2. Click **Add** → **Standard VM**
3. Browse to Java 21 installation
4. Mark as default

---

## Gradle Configuration

The project `build.gradle` specifies Java 21:

```groovy
java {
  toolchain {
    languageVersion = JavaLanguageVersion.of(21)
  }
}
```

This ensures:
- Gradle downloads Java 21 if not installed (automatic)
- Compilation uses Java 21
- IDE recognizes correct version

**Gradle will auto-download Java if needed** (Gradle 7.4+)

---

## Verify Setup

### Build the Project
```bash
cd backend
./gradlew clean build -x test
# Should succeed without errors
```

### Run Backend Locally
```bash
cd backend
./gradlew bootRun
# Should start on http://localhost:8080
```

### Check Compilation
```bash
./gradlew compileJava
# Should complete in ~10s
```

---

## JDK vs JRE

### JDK (Java Development Kit)
- **Includes**: Compiler (javac), tools, debugger
- **Use**: Development, building, testing
- **Required for**: `./gradlew build`, IDE development
- **Size**: ~300-400 MB

### JRE (Java Runtime Environment)
- **Includes**: Runtime only, no compiler
- **Use**: Running compiled applications
- **Size**: ~150-200 MB
- **In this project**: Used in production Docker image (`eclipse-temurin:21-jre`)

**For local development: Install JDK (includes JRE)**
**For production: Use JRE-only Docker image**

---

## Troubleshooting

### "java: command not found"
```bash
# Check if Java is installed
which java

# Add to PATH
export PATH="/path/to/java/bin:$PATH"
echo $PATH  # Verify
```

### "wrong version of Java"
```bash
# List installed versions (SDK Manager)
sdk list java

# List installed versions (Manual)
ls /Library/Java/JavaVirtualMachines/  # macOS
ls /usr/lib/jvm/  # Linux

# Switch version
sdk use java 21.0.1-tem
```

### IDE doesn't recognize Java 21
- **Restart IDE** (important!)
- **Invalidate VS Code cache**: `rm -rf ~/.vscode/.server`
- **Check IDE Java version**:
  ```bash
  # VS Code
  java -version  # from command palette
  ```

### Build fails with "Unsupported class version"
```bash
# Check compiler version
javac -version

# Must be 21.x - if not, switch JDK
sdk default java 21.0.1-tem
```

### Memory issues during build
```bash
export _JAVA_OPTIONS="-Xmx2048m -Xms512m"
./gradlew clean build
```

---

## Gradle Wrapper

This project uses **Gradle Wrapper** - no need to install Gradle separately!

```bash
# Gradle wrapper handles everything
./gradlew --version          # Show Gradle version
./gradlew build              # Build with automatic JDK
./gradlew bootRun            # Run with automatic JDK
./gradlew test               # Run tests
./gradlew clean              # Clean build
```

---

## Docker (Alternative)

**Run backend without local Java**:
```bash
# Build Docker image (includes JDK)
docker build -f backend/Dockerfile -t live-presence-backend:latest ./backend

# Run container
docker run -p 8080:8080 live-presence-backend:latest

# Check logs
docker logs -f <container-id>
```

**Check Java in container**:
```bash
docker run --rm eclipse-temurin:21-jdk java -version
```

---

## Quick Start Checklist

- [ ] Java 21 installed (`java -version` returns 21.x)
- [ ] JAVA_HOME set (`echo $JAVA_HOME` shows valid path)
- [ ] IDE configured to use Java 21
- [ ] Backend builds: `./gradlew build -x test`
- [ ] Backend runs: `./gradlew bootRun`
- [ ] Can access http://localhost:8080/actuator/health

---

## More Resources

- [JDK 21 Release Notes](https://jdk.java.net/21/)
- [SDKMAN Documentation](https://sdkman.io/)
- [Gradle Toolchains](https://docs.gradle.org/current/userguide/toolchains.html)
- [Spring Boot Java Versions](https://spring.io/blog/2023/09/21/spring-boot-3-1-4-available-now)
