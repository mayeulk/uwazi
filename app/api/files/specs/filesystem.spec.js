import { testingTenants } from 'api/utils/testingTenants';
import { uwaziFS as fs } from '../uwaziFS';
import { deleteFiles, fileExists, storeFile, activityLogPath } from '../filesystem';

describe('files', () => {
  beforeEach(async () => {
    await fs.writeFile(`${__dirname}/file1`, '');
    await fs.writeFile(`${__dirname}/file2`, '');
    await deleteFiles([`${__dirname}/customFile`]);
  });

  afterEach(async () => {
    await deleteFiles([`${__dirname}/customFile`]);
  });

  describe('deleteFiles', () => {
    it('should delete all files passed', async () => {
      await deleteFiles([`${__dirname}/file1`, `${__dirname}/file2`]);
      expect(await fileExists(`${__dirname}/file1`)).toBe(false);
      expect(await fileExists(`${__dirname}/file2`)).toBe(false);
    });

    it('should not fail when trying to delete a non existent file', async () => {
      await deleteFiles([`${__dirname}/file0`, `${__dirname}/file1`, `${__dirname}/file2`]);
      expect(await fileExists(`${__dirname}/file1`)).toBe(false);
      expect(await fileExists(`${__dirname}/file2`)).toBe(false);
    });
  });
  describe('activityLogPath', () => {
    it('should return the activity file name of the tenant in the log folder', () => {
      testingTenants.mockCurrentTenant({ name: 'default', activityLogs: 'log/' });
      const logPath = activityLogPath('default_activity.log');
      expect(logPath).toBe('log/default_activity.log');
    });
  });

  describe('storeFile', () => {
    const mockedFilePath = () => `${__dirname}/customFile`;
    const generateFile = () => ({
      originalname: 'file1',
      mimetype: 'image/jpeg',
      size: 12,
      buffer: Buffer.from('sample content'),
    });

    it('should store files with auto-generated filenames', async () => {
      const storedFile = await storeFile(mockedFilePath, generateFile());

      expect(await fileExists(`${__dirname}/customFile`)).toBe(true);
      expect(storedFile.filename).not.toBeUndefined();
      expect(storedFile.filename).not.toBe('file1');
      expect(storedFile.originalname).toBe('file1');
      expect(storedFile.destination).toBe(`${__dirname}/customFile`);
    });

    it('should allow sending custom filename instead of autogenerated filename', async () => {
      const storedFile = await storeFile(
        mockedFilePath,
        { ...generateFile(), filename: 'customFilename.jpg' },
        true
      );

      expect(storedFile.filename).toBe('customFilename.jpg');
      expect(storedFile.originalname).toBe('file1');
    });

    it('should not override name if missing flag for override', async () => {
      const storedFile = await storeFile(mockedFilePath, {
        ...generateFile(),
        filename: 'customFilename.jpg',
      });

      expect(storedFile.filename).not.toBe('customFilename.jpg');
      expect(storedFile.originalname).toBe('file1');
    });
  });
});
