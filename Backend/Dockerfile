# Use official Maven image that includes Java 17 and Maven
FROM maven:3.9.9-eclipse-temurin-17 AS build

WORKDIR /app
COPY . .

# Build the app
RUN mvn clean package -DskipTests

# Second stage (runtime)
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# Copy the JAR file from the first build stage
COPY --from=build /app/target/*.jar app.jar

# Run the app
ENTRYPOINT ["java", "-jar", "app.jar"]
