import { CheckCircle2, Circle } from 'lucide-react';
import type { ProfileReadiness, ProfileRequirementId } from '@/services/profileService';

const REQUIREMENT_LABELS: Record<ProfileRequirementId, string> = {
  name: 'Tên hiển thị',
  age: 'Tuổi từ 17 trở lên',
  campus: 'Campus',
  major: 'Ngành học',
  interests: 'Ít nhất 3 sở thích',
  personalityTags: 'Ít nhất 1 vibe cá nhân',
  datingGoals: 'Ít nhất 1 mục tiêu kết nối',
  profileText: 'Ít nhất 1 bio hoặc câu trả lời',
};

interface ProfileCompletenessChecklistProps {
  readiness: ProfileReadiness;
  layout?: 'stack' | 'grid';
}

const ProfileCompletenessChecklist = ({
  readiness,
  layout = 'stack',
}: ProfileCompletenessChecklistProps) => (
  <div className={layout === 'grid' ? 'grid sm:grid-cols-2 gap-2' : 'space-y-3'}>
    {readiness.requirements.map(requirement => {
      const Icon = requirement.isMet ? CheckCircle2 : Circle;
      return (
        <div
          key={requirement.id}
          className={`flex items-center gap-3 rounded-xl px-3 py-2 font-medium ${
            layout === 'grid' ? 'text-xs' : 'text-sm'
          } ${
            requirement.isMet
              ? 'bg-primary/10 text-primary'
              : 'bg-muted/50 text-muted-foreground'
          }`}
        >
          <Icon className="w-4 h-4 shrink-0" />
          <span>{REQUIREMENT_LABELS[requirement.id]}</span>
        </div>
      );
    })}
  </div>
);

export default ProfileCompletenessChecklist;
