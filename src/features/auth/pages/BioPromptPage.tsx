import { useState } from 'react';
import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { User } from '@/types';

interface BioPromptPageProps {
  user: User;
  onComplete: (bio: string) => void;
}

const BioPromptPage = ({ user, onComplete }: BioPromptPageProps) => {
  const [bio, setBio] = useState('');

  const handleSave = () => {
    // Update UI instantly, save to Firestore in background
    onComplete(bio);
    updateDoc(doc(db, 'users', user.id), { bio }).catch(console.error);
  };

  return (
    <div className="px-4 pb-6 pt-2">
      <div className="glass-card rounded-3xl p-6 shadow-float space-y-5">
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center shadow-card mx-auto mb-3">
            <Heart className="w-6 h-6 text-primary-foreground fill-primary-foreground" />
          </div>
          <h2 className="font-serif text-2xl font-bold text-foreground mb-1">Giới thiệu bản thân</h2>
          <p className="text-muted-foreground text-sm">Viết vài dòng để mọi người biết thêm về bạn</p>
        </div>

        <div className="space-y-2">
          <textarea
            placeholder="Vài dòng về bạn..."
            value={bio}
            onChange={e => setBio(e.target.value)}
            rows={4}
            maxLength={200}
            className="w-full rounded-xl bg-muted/30 border border-border/50 px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none resize-none text-sm"
          />
          <p className="text-xs text-muted-foreground text-right">{bio.length}/200</p>
        </div>

        <Button
          onClick={handleSave}
          disabled={!bio.trim()}
          className="w-full h-14 rounded-xl gradient-primary text-primary-foreground font-semibold shadow-card hover:shadow-float transition-all duration-300"
        >
          Lưu
        </Button>

        <div className="text-center">
          <button
            type="button"
            onClick={() => onComplete('')}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Bỏ qua
          </button>
        </div>
      </div>
    </div>
  );
};

export default BioPromptPage;
