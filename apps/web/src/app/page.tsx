import Hero from "@/components/home/Hero";
import Steps from "@/components/home/Steps";
import ProductRail from "@/components/home/ProductRail";
import BulkCalculator from "@/components/home/BulkCalculator";
import Social from "@/components/home/Social";

export default function HomePage() {
  return (
    <>
      <Hero />
      <Steps />
      <ProductRail />
      <BulkCalculator />
      <Social />
    </>
  );
}
