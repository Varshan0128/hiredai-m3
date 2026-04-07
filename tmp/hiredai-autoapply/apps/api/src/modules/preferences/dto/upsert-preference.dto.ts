import {
  IsBoolean, IsOptional, IsArray, IsString,
  IsNumber, IsEnum, IsDateString, Min, Max
} from "class-validator";

enum WorkMode { remote = "remote", hybrid = "hybrid", onsite = "onsite" }
enum CompanyType { mnc = "mnc", startup = "startup", product_based = "product_based", service_based = "service_based" }
enum ExperienceLevel { entry = "entry", junior = "junior", mid = "mid", senior = "senior", lead = "lead" }

export class UpsertPreferenceDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsBoolean() fullyAutomatic?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) targetRoles?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) preferredLocations?: string[];
  @IsOptional() @IsNumber() @Min(0) minSalary?: number;
  @IsOptional() @IsNumber() @Min(0) maxSalary?: number;
  @IsOptional() @IsArray() @IsEnum(WorkMode, { each: true }) workModes?: WorkMode[];
  @IsOptional() @IsArray() @IsEnum(CompanyType, { each: true }) companyTypes?: CompanyType[];
  @IsOptional() @IsArray() @IsEnum(ExperienceLevel, { each: true }) experienceLevels?: ExperienceLevel[];
  @IsOptional() @IsDateString() postingDateFrom?: string;
  @IsOptional() @IsDateString() postingDateTo?: string;
  @IsOptional() @IsNumber() @Min(1) @Max(100) maxApplicationsPerDay?: number;
  @IsOptional() @IsNumber() @Min(1) @Max(500) maxApplicationsPerWeek?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) minimumMatchScore?: number;
  @IsOptional() @IsString() timezone?: string;
}
