import { SanitizeString } from './sanitizer.util';
import { plainToInstance } from 'class-transformer';

class TestClass {
  @SanitizeString()
  data: any;
}

describe('SanitizeString', () => {
  it('should sanitize a single string', () => {
    const obj = { data: '<script>alert("xss")</script>hello' };
    const result = plainToInstance(TestClass, obj);
    expect(result.data).toBe('alert("xss")hello');
  });

  it('should sanitize an array of strings', () => {
    const obj = { data: ['<p>test</p>', '   <script>bad</script>ok   ', 123] };
    const result = plainToInstance(TestClass, obj);
    expect(result.data).toEqual(['test', 'badok', 123]);
  });

  it('should ignore non-string scalar values', () => {
    const obj = { data: 12345 };
    const result = plainToInstance(TestClass, obj);
    expect(result.data).toBe(12345);
  });
});
