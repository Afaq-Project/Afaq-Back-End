const fs = require('fs');
const file = 'src/modules/profile/controllers/skills.controller.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "import { SkillsService } from '../services/skills.service';",
  "import { SkillsService } from '../services/skills.service';\nimport { SkillOwnershipGuard } from '../guards/skill-ownership.guard';"
);

content = content.replace(
  "@Patch(':skillId')",
  "@Patch(':skillId')\n  @UseGuards(SkillOwnershipGuard)"
);

content = content.replace(
  "@Delete(':skillId')",
  "@Delete(':skillId')\n  @UseGuards(SkillOwnershipGuard)"
);

fs.writeFileSync(file, content);
