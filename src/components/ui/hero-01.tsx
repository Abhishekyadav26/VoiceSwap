import HeroSection from "@/components/ui/hero-01-utils/hero";
import type { NavigationSection } from "@/components/ui/hero-01-utils/header";
import Header from "@/components/ui/hero-01-utils/header";
import BrandSlider, {
  type BrandList,
} from "@/components/ui/hero-01-utils/brand-slider";
import type { AvatarList } from "@/components/ui/hero-01-utils/hero";

export default function AgencyHeroSection() {
  const avatarList: AvatarList[] = [
    { image: "https://randomuser.me/api/portraits/men/32.jpg", name: "Trader 1" },
    { image: "https://randomuser.me/api/portraits/women/44.jpg", name: "Trader 2" },
    { image: "https://randomuser.me/api/portraits/men/45.jpg", name: "Trader 3" },
    { image: "https://randomuser.me/api/portraits/women/68.jpg", name: "Trader 4" },
  ];

  const navigationData: NavigationSection[] = [
    { title: "Terminal", href: "/terminal", isActive: true },
    { title: "Preview", href: "/terminal#preview" },
    { title: "Wallet", href: "/terminal#wallet" },
  ];

  const brandList: BrandList[] = [
    { name: "Jupiter" },
    { name: "Solana" },
    { name: "Phantom" },
    { name: "Solflare" },
    { name: "Groq" },
  ];

  return (
    <div className="relative">
      <Header navigationData={navigationData} />
      <main>
        <HeroSection avatarList={avatarList} />
        <BrandSlider brandList={brandList} />
      </main>
    </div>
  );
}
