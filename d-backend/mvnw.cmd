@REM ----------------------------------------------------------------------------
@REM Maven Wrapper startup script for Windows
@REM ----------------------------------------------------------------------------

@echo off
setlocal enabledelayedexpansion

set "MAVEN_PROJECTBASEDIR=%CD%"
set "MAVEN_WRAPPER_DIR=%MAVEN_PROJECTBASEDIR%\.mvn\wrapper"

if not defined MAVEN_USER_HOME (
    set "MAVEN_USER_HOME=%USERPROFILE%\.m2"
)

set "MAVEN_OPTS=-Xmx1024m"

set "WRAPPER_JAR=%MAVEN_WRAPPER_DIR%\maven-wrapper.jar"
set "WRAPPER_PROPERTIES=%MAVEN_WRAPPER_DIR%\maven-wrapper.properties"

if not exist "%WRAPPER_JAR%" (
    echo Maven wrapper jar not found: %WRAPPER_JAR%
    exit /b 1
)

java -cp "%WRAPPER_JAR%" ^
  -Dmaven.multiModuleProjectDirectory="%MAVEN_PROJECTBASEDIR%" ^
  -Dmaven.wrapper.properties="%WRAPPER_PROPERTIES%" ^
  org.apache.maven.wrapper.MavenWrapperMain %*

endlocal
