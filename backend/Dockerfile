# syntax=docker/dockerfile:1

# ── Build stage ───────────────────────────────────────────────────────────────
# Compile and package the app with JDK 21 and the Maven wrapper.
FROM eclipse-temurin:21-jdk AS build
WORKDIR /app

# Resolve dependencies first so this layer stays cached unless pom.xml changes.
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN chmod +x mvnw && ./mvnw -B dependency:go-offline

# Build the executable jar. Tests are skipped in the image build (they need a
# live database); run them in dev/CI instead.
COPY src/ src/
RUN ./mvnw -B clean package -DskipTests

# ── Runtime stage ─────────────────────────────────────────────────────────────
# Minimal JRE image — only the built jar is carried over (small final image).
FROM eclipse-temurin:21-jre AS runtime
WORKDIR /app

# Run as an unprivileged user.
RUN useradd -r -u 1001 spring
COPY --from=build /app/target/*.jar app.jar
USER spring

# Production profile: Flyway + ddl-auto=validate, no SQL logging, env-based
# CORS/WS origins. Can be overridden by a Render env var if ever needed.
ENV SPRING_PROFILES_ACTIVE=prod

# Render injects PORT and the app binds to it (server.port=${PORT:8081} in the
# prod profile). EXPOSE is informational; Render detects the listening port.
EXPOSE 8081

# Exec form so SIGTERM reaches the JVM for graceful shutdown on redeploys.
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
