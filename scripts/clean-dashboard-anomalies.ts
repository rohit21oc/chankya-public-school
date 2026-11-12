import { persistentStorage } from '../server/storage/persistentStorage.ts';
import { ClassModel, NoticeModel, ExamModel } from '../server/models/index.ts';

async function cleanup() {
  await persistentStorage.initialize();
  console.log('Connected to storage');

  // 1. Mark ELP as INACTIVE
  const classes = await persistentStorage.loadClasses();
  const elpClass = classes.find((c) => c.name === 'ELP' || c.id === 'c-1790998355737');
  if (elpClass) {
    elpClass.status = 'INACTIVE' as any;
    (elpClass as any).isActive = false;
    persistentStorage.saveClassesToDisk(classes);
    if (persistentStorage.isReady()) {
      await ClassModel.updateOne({ id: elpClass.id }, { $set: { status: 'INACTIVE', isActive: false } });
    }
    console.log('ELP class marked as INACTIVE');
  }

  // 2. Remove / deactivate debug notices
  const notices = await persistentStorage.loadNotices();
  const cleanNotices = notices.filter((n) => {
    const title = (n.title || '').trim().toLowerCase();
    const id = (n.id || '').trim().toLowerCase();
    if (
      id.includes('test-debug') ||
      title.includes('debug draft') ||
      title.startsWith('test all notice') ||
      /msg \d+$/i.test(title)
    ) {
      return false;
    }
    return true;
  });
  console.log('Notices before:', notices.length, 'after:', cleanNotices.length);
  persistentStorage.saveNoticesToDisk(cleanNotices);
  if (persistentStorage.isReady()) {
    await NoticeModel.deleteMany({
      $or: [
        { id: /test-debug/i },
        { title: /debug draft/i },
        { title: /test all notice/i },
        { title: /msg \d+$/i },
      ],
    });
  }

  // 3. Fix exam-evaluation-1790678180924 missing dates
  const exams = await persistentStorage.loadExams();
  const brokenExam = exams.find((e) => e.id === 'exam-evaluation-1790678180924');
  if (brokenExam && (!brokenExam.startDate || !brokenExam.endDate)) {
    brokenExam.startDate = '2026-09-25';
    brokenExam.endDate = '2026-09-29';
    persistentStorage.saveExamsToDisk(exams);
    if (persistentStorage.isReady()) {
      await ExamModel.updateOne(
        { id: brokenExam.id },
        { $set: { startDate: '2026-09-25', endDate: '2026-09-29' } }
      );
    }
    console.log('Updated dates for exam-evaluation-1790678180924');
  }

  console.log('Cleanup completed successfully');
  process.exit(0);
}

cleanup().catch((err) => {
  console.error(err);
  process.exit(1);
});
