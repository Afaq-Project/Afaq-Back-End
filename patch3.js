const fs = require('fs');
const path = './src/common/filters/all-exceptions.filter.ts';
let code = fs.readFileSync(path, 'utf8');

if (!code.includes("import { Prisma } from '@prisma/client'")) {
    code = code.replace("import { ThrottlerException }", "import { Prisma } from '@prisma/client';\nimport { ThrottlerException }");
}

const findCode = `
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;
`;

const replaceCode = `
    let status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        exceptionResponse = { message: 'Resource not found' };
      } else if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        exceptionResponse = { message: 'Resource already exists or conflicts with another record' };
      }
    }
`;

code = code.replace(findCode.trim(), replaceCode.trim());
fs.writeFileSync(path, code);
