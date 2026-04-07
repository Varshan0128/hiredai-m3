import { IsString, IsBoolean, IsOptional } from "class-validator";
export class UpdateResumeDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() roleTag?: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}
