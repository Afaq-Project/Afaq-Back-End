const fs = require('fs');
const file = 'src/modules/users/users.controller.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace("import { formatUserResponse } from '../../common/utils/user-mapper.util';\n\nexport class UsersController", "export class UsersController");

content = "import { formatUserResponse } from '../../common/utils/user-mapper.util';\n" + content;

fs.writeFileSync(file, content);
