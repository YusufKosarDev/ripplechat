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

# Unpack the fat jar into an exploded layout: gives the stable classpath that
# CDS requires and skips nested-jar unpacking at startup.
RUN java -Djarmode=tools -jar app.jar extract --destination application && rm app.jar

# CDS training run: boot the context once, exit as soon as it refreshes, and
# dump the loaded-class archive (app.jsa) that the real start maps back in.
# The flags below only let the refresh complete with no database/Redis in the
# build sandbox: Flyway is excluded via autoconfigure (spring.flyway.enabled
# must STAY true — the lockProvider bean's dev-mode branch would otherwise
# CREATE TABLE and hit the missing database), Hibernate is told not to touch
# JDBC, and the dummy datasource/JWT values are build-time throwaways, not
# credentials. None of it is baked into the archive: at runtime the real env
# vars apply exactly as before.
RUN java -XX:ArchiveClassesAtExit=application/app.jsa \
      -Dspring.context.exit=onRefresh \
      -Dspring.profiles.active=prod \
      -Dspring.autoconfigure.exclude=org.springframework.boot.flyway.autoconfigure.FlywayAutoConfiguration \
      -Dspring.jpa.hibernate.ddl-auto=none \
      -Dspring.jpa.properties.hibernate.boot.allow_jdbc_metadata_access=false \
      -Dapp.search.elasticsearch.enabled=false \
      -DPOSTGRES_HOST_PORT=5432 -DPOSTGRES_DB=training \
      -DPOSTGRES_USER=training -DPOSTGRES_PASSWORD=training \
      -DJWT_SECRET=cds-training-run-throwaway-0123456789abcdef0123456789abcdef \
      -jar application/app.jar

USER spring

# Production profile: Flyway + ddl-auto=validate, no SQL logging, env-based
# CORS/WS origins. Can be overridden by a Render env var if ever needed.
ENV SPRING_PROFILES_ACTIVE=prod

# Render injects PORT and the app binds to it (server.port=${PORT:8081} in the
# prod profile). EXPOSE is informational; Render detects the listening port.
EXPOSE 8081

# The app already exposes /actuator/health and permits it unauthenticated, so an
# orchestrator can use it directly. start-period covers JVM boot plus Flyway on
# a cold database; the app is not expected to answer before that.
HEALTHCHECK --interval=30s --timeout=3s --start-period=90s --retries=3 \
    CMD curl -fsS "http://localhost:${PORT:-8081}/actuator/health" || exit 1

# Exec form so SIGTERM reaches the JVM for graceful shutdown on redeploys.
#
# The heap flags matter on a small instance: with none, the JVM takes 25% of the
# container limit, so a 512 MB host gives the app ~128 MB and spends the rest on
# nothing. SerialGC is the right collector at that size — G1's overhead buys
# nothing below a couple of cores — and ExitOnOutOfMemoryError makes the
# container die and restart rather than limp along swapping.
#
# -Xshare:auto (the default) means a missing or stale CDS archive degrades to a
# normal start instead of failing.
ENTRYPOINT ["java", \
    "-XX:MaxRAMPercentage=75", \
    "-XX:+UseSerialGC", \
    "-XX:+ExitOnOutOfMemoryError", \
    "-XX:SharedArchiveFile=/app/application/app.jsa", \
    "-jar", "/app/application/app.jar"]
