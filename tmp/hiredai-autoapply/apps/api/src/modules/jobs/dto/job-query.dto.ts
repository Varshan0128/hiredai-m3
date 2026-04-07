import { IsOptional, IsString, IsNumber, Min, IsEnum } from "class-validator";
import { Type } from "class-transformer";

export class JobQueryDto {
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) limit?: number;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() source?: string;
  @IsOptional() @IsString() decision?: string;
}
