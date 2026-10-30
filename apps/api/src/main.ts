import "reflect-metadata";
import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { ConfigurationError, readRuntimeConfig } from "./config/runtime.js";
import { Logger, ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { ApplicationLogger } from "./config/logger.js";
import { AppModule } from "./app.module.js";
import { DomainErrorFilter } from "./http/domain-error.filter.js";

const logger = new ApplicationLogger("Commerce", { json: true });
Logger.overrideLogger(logger);

async function bootstrap() {
  const config = readRuntimeConfig();
  const app = await NestFactory.create(AppModule, { abortOnError: false, logger });
  try {
    app.enableShutdownHooks();
    app.useGlobalFilters(new DomainErrorFilter());
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    app.enableCors({ origin: config.origins });

    const swagger = new DocumentBuilder().setTitle("Commerce Platform API")
      .setDescription("Incremental headless commerce backend — development only until all acceptance gates pass.")
      .setVersion("0.1.0").addCookieAuth("delcu_session", {type:"apiKey",in:"cookie"}, "merchantSession").build();
    SwaggerModule.setup("docs", app, SwaggerModule.createDocument(app, swagger));

    const port = config.port;
    await app.listen(port, "127.0.0.1");
    Logger.log(`Commerce API listening on loopback port ${port} (${config.driver})`, "Bootstrap");
  } catch (error) {
    await app.close();
    throw error;
  }
}

bootstrap().catch(error => {
  if (error instanceof ConfigurationError) logger.warn({ event: "configuration_error", message: error.message });
  else logger.error(error);
  process.exitCode = 1;
});
