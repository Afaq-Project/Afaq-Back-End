import re

with open('src/modules/profile/dto/create-education.dto.ts', 'r') as f:
    content = f.read()

content = content.replace('IsString,\n', '')
content = content.replace("import { ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface, registerDecorator, ValidationOptions } from 'class-validator';\n", '')
content = content.replace("ValidateIf,\n} from 'class-validator';", "ValidateIf,\n  ValidationArguments,\n  ValidatorConstraint,\n  ValidatorConstraintInterface,\n  registerDecorator,\n  ValidationOptions,\n} from 'class-validator';")
content = content.replace("@ValidateIf((o) => o.gpaRaw !== undefined && o.gpaRaw !== null)", "@ValidateIf((o: CreateEducationDto) => o.gpaRaw !== undefined && o.gpaRaw !== null)")

with open('src/modules/profile/dto/create-education.dto.ts', 'w') as f:
    f.write(content)

with open('src/modules/profile/services/educations.service.ts', 'r') as f:
    content = f.read()

content = content.replace('this.prisma.educationLevels.findUnique', 'this.prisma.educationLevel.findUnique')

with open('src/modules/profile/services/educations.service.ts', 'w') as f:
    f.write(content)

