🛒 AWS Product Order – Spring Boot + AWS CDK

A small learning project that demonstrates how to build and deploy a Spring Boot microservice on AWS using RDS + Docker + CDK.
The application exposes basic APIs for managing product orders and is designed to stay within AWS free-tier usage.

✅ Features

- Spring Boot backend (Java 17)

- Product Order APIs

- AWS RDS (MySQL)

- Docker support

- AWS CDK deployment

- Runs locally or in AWS

- Environment-based configuration

🏗 Architecture

Client → API → Service → Repository → RDS (MySQL)


Infrastructure:

AWS CDK → (VPC) → RDS + EC2 / Elastic Beanstalk

📦 Tech Stack

- Java 17
- Spring Boot 3
- MySQL (AWS RDS)
- AWS CDK
- Docker
- Maven


🧰 Prerequisites

- Java 17+

- Maven

- Docker

- AWS CLI configured

- AWS CDK installed (npm install -g aws-cdk)

▶ Running Locally

Update application.properties (local DB)

Build
- mvn clean install


Run
- mvn spring-boot:run

🐳 Build With Docker
- docker build -t product-order .
- docker run -p 8080:8080 product-order

🚀 Deploy with AWS CDK

- Inside cdk/ folder:
  - cdk bootstrap
  - cdk deploy

🚀 Deploy via CI/CD (GitHub Actions)

- This project includes a CI/CD pipeline that:
  - Builds the Spring Boot project
  - Packages the app into a .zip file
  - Uploads it to S3

  - Updates the Elastic Beanstalk environment

  - Verifies deployment status

  - Every push to main automatically triggers deployment.

  - AWS credentials are stored as GitHub Action secrets.


🔌 API Endpoints
| Method | Endpoint       | Description    |
| ------ | -------------- | -------------- |
| GET    | `/order`      | Get all orders |
| POST   | `/order`      | Create order   |
| GET    | `/order/{id}` | Get order      |
| GET | `/products/` | Get all Products   |
| POST | `/products/` | Post Product   |
| GET | `/products/{id}` | Get Product   |


📁 Project Structure
Aws-Product-Order

 ├── src/main/java

 │   └── … Spring Boot code
 
 ├── Dockerfile
 
 ├── cdk/   (AWS CDK infra)
 
 ├── pom.xml
 
 └── README.md


✅ Working locally
✅ Deployed using AWS CDK
🔄 Enhancements planned

📚 Learning Goals

- Practice AWS free-tier deployments

- Build + containerize Java services

- Use AWS CDK for IaC

- Work with RDS + security groups

- Build small but production-like workflow

📌 Future Enhancements

- Add authentication
- Add unit & integration tests
- Monitoring / Alarms
