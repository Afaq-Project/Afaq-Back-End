import re

with open('test/profile.e2e-spec.ts', 'r') as f:
    content = f.read()

new_block = """
  describe('Test Results E2E (Batch 4)', () => {
    let test1Id = '';
    
    beforeAll(async () => {
      const t1 = await prisma.standardizedTests.create({
        data: {
          nameEn: 'IELTS E2E',
          nameAr: 'IELTS E2E',
          minScore: 0.0,
          maxScore: 9.0,
          scoreStep: 0.5,
          isActive: true
        }
      });
      test1Id = t1.id;
    });

    afterAll(async () => {
      await prisma.userTestResults.deleteMany();
      await prisma.standardizedTests.deleteMany({ where: { nameEn: 'IELTS E2E' } });
    });

    it('[EC-028] Invalid testId -> 404', async () => {
      const invalidUuid = '00000000-0000-0000-0000-000000000000';
      const res = await request(app.getHttpServer())
        .post('/api/v1/profile/test-results')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ testId: invalidUuid, score: 7.5 })
        .expect(404);
    });

    it('[EC-029] Score out of bounds -> 400', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/profile/test-results')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ testId: test1Id, score: 10.0 })
        .expect(400);
    });

    it('[EC-030] Score not aligned to step -> 400', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/profile/test-results')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ testId: test1Id, score: 7.3 })
        .expect(400);
    });

    it('[EC-031] Max tests reached -> 400', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/profile/test-results')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ testId: test1Id, score: 7.5 })
        .expect(201);
    });

    it('[EC-032] Test already exists -> 409', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/profile/test-results')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ testId: test1Id, score: 8.0 })
        .expect(409);
    });

    it('[EC-033] Update with out of bounds -> 400', async () => {
      const list = await request(app.getHttpServer())
        .get('/api/v1/profile/test-results')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
        
      const resId = list.body.data[0].id;
      
      await request(app.getHttpServer())
        .patch(`/api/v1/profile/test-results/${resId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ score: 9.5 })
        .expect(400);
    });

    it('[EC-034] Valid Delete -> 204', async () => {
      const list = await request(app.getHttpServer())
        .get('/api/v1/profile/test-results')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
        
      const resId = list.body.data[0].id;
      
      await request(app.getHttpServer())
        .delete(`/api/v1/profile/test-results/${resId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(204);
    });
  });
});
"""

# Replace the last `});\n});` -> actually just look for `});\n});\n` or similar
# Better: just remove the last `});` and append new_block
content = content.rstrip()
if content.endswith('});'):
    content = content[:-3] + new_block
    with open('test/profile.e2e-spec.ts', 'w') as f:
        f.write(content)
else:
    print("Error: Could not find ending '});'")
