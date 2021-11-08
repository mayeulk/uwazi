import fs from 'fs';
import { activityLogPath } from 'api/files';
import { testingTenants } from 'api/utils/testingTenants';
import { deleteFiles } from '../filesystem';

describe('files', () => {
  beforeEach(() => {
    fs.writeFileSync(`${__dirname}/file1`, '');
    fs.writeFileSync(`${__dirname}/file2`, '');
  });

  afterAll(() => {
    fs.unlinkSync(`${__dirname}/file1`);
    fs.unlinkSync(`${__dirname}/file2`);
  });

  describe('deleteFiles', () => {
    it('should delete all files passed', async () => {
      await deleteFiles([`${__dirname}/file1`, `${__dirname}/file2`]);
      expect(fs.existsSync(`${__dirname}/file1`)).toBe(false);
      expect(fs.existsSync(`${__dirname}/file2`)).toBe(false);
    });

    it('should not fail when trying to delete a non existent file', async () => {
      await deleteFiles([`${__dirname}/file0`, `${__dirname}/file1`, `${__dirname}/file2`]);
      expect(fs.existsSync(`${__dirname}/file1`)).toBe(false);
      expect(fs.existsSync(`${__dirname}/file2`)).toBe(false);
    });
  });
  describe('activityLogPath', () => {
    it('should return the activity file name of the tenant in the log folder', () => {
      testingTenants.mockCurrentTenant({ name: 'default', activityLogs: 'log/' });
      const logPath = activityLogPath();
      expect(logPath).toBe('log/default_activity.log');
    });
  });
});
