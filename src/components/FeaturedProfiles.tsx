import ProfileCard from "./ProfileCard";

const profiles = [
  {
    name: "Minh Anh",
    age: 24,
    location: "Hồ Chí Minh",
    image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=600&fit=crop&crop=face",
    bio: "Yêu du lịch và khám phá ẩm thực. Đang tìm người cùng chia sẻ những chuyến phiêu lưu 🌍✨"
  },
  {
    name: "Hoàng Nam",
    age: 27,
    location: "Hà Nội",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=600&fit=crop&crop=face",
    bio: "Software engineer by day, guitarist by night 🎸 Tìm người yêu nhạc acoustic."
  },
  {
    name: "Thu Hương",
    age: 25,
    location: "Đà Nẵng",
    image: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&h=600&fit=crop&crop=face",
    bio: "Coffee addict ☕ Thích đọc sách và những buổi chiều yên bình bên biển."
  },
];

const FeaturedProfiles = () => {
  return (
    <section className="py-24 bg-background">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center mb-16">
          <span className="text-primary font-medium text-sm uppercase tracking-wider">
            Profiles nổi bật
          </span>
          <h2 className="font-serif text-4xl md:text-5xl font-bold text-foreground mt-3">
            Gặp gỡ những người{" "}
            <span className="text-gradient">thú vị</span>
          </h2>
          <p className="text-muted-foreground mt-4 max-w-xl mx-auto">
            Khám phá những profiles được yêu thích nhất trong tuần này
          </p>
        </div>

        {/* Profile Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {profiles.map((profile, index) => (
            <div 
              key={profile.name}
              className="animate-slide-up"
              style={{ animationDelay: `${index * 0.15}s` }}
            >
              <ProfileCard {...profile} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturedProfiles;
