import re

with open("src/modules/profile/dto/update-profile.dto.ts", "r") as f:
    content = f.read()

# Fields that shouldn't be cleared to null
fields = [
    "firstName",
    "lastName",
    "email",
    "dateOfBirth",
    "gender",
    "maritalStatusId",
    "phone",
    "countryOfResidenceId",
    "nationalityId",
    "currentCityId",
    "educationLevelId"
]

for field in fields:
    # Find the block for the field and replace @IsOptional() with @ValidateIf((object, value) => value !== undefined)
    # The pattern looks like:
    # @IsOptional()
    # ...
    # field?: type;
    
    # We can just replace @IsOptional() with @ValidateIf((object, value) => value !== undefined) 
    # but only for these fields.
    
    # We will use regex to find the block
    pattern = r'(@IsOptional\(\)\s+(?:@[A-Za-z0-9_]+\([^)]*\)\s+)*' + field + r'\?:)'
    
    def replacer(match):
        return match.group(1).replace('@IsOptional()', '@ValidateIf((object, value) => value !== undefined)')

    content = re.sub(pattern, replacer, content)

with open("src/modules/profile/dto/update-profile.dto.ts", "w") as f:
    f.write(content)
