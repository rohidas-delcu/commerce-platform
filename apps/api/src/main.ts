import "reflect-metadata";
import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module.js";
import { DomainErrorFilter } from "./http/domain-error.filter.js";

async function bootstrap() {
  // No real merchant authentication exists in milestone 1: refuse all production startup.
  if (process.env.NODE_ENV === "production") {
    throw new Error("Production mode requires real merchant authentication; milestone 1 is demo-only.");
  }
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  app.useGlobalFilters(new DomainErrorFilter());
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  const origins = (process.env.CORS_ORIGINS || "http://localhost:5173").split(",").map(o => o.trim());
  app.enableCors({ origin: origins });

  const swagger = new DocumentBuilder().setTitle("Commerce Platform API")
    .setDescription("Milestone 1 local development API — not for production merchant authentication.")
    .setVersion("0.1.0").build();
  SwaggerModule.setup("docs", app, SwaggerModule.createDocument(app, swagger));

  const port = Number(process.env.PORT || 3000);
  await app.listen(port, "127.0.0.1");
  console.log(`Commerce API listening at http://127.0.0.1:${port}`);
}

bootstrap().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
