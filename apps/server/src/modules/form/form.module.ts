import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { FormController } from "./form.controller";
import { FormService } from "./form.service";
import { FormEntity, FormSchema } from "./form.schema";

@Module({
  imports: [MongooseModule.forFeature([{ name: FormEntity.name, schema: FormSchema }])],
  controllers: [FormController],
  providers: [FormService],
  exports: [FormService]
})
export class FormModule {}
