const fs = require('fs');
const path = './src/common/filters/all-exceptions.filter.ts';
let code = fs.readFileSync(path, 'utf8');

const prismaLogic = `
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

code = code.replace(/let status =[\s\S]*?\}[\s\S]*?\}[\s\S]*?\}/, prismaLogic.trim());
fs.writeFileSync(path, code);
