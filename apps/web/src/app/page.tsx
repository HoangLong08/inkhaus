import Hero from "@/components/home/Hero";
import Steps from "@/components/home/Steps";
import Categories from "@/components/home/Categories";
import ProductRail from "@/components/home/ProductRail";
import FeaturedGrid from "@/components/home/FeaturedGrid";
import BulkCalculator from "@/components/home/BulkCalculator";
import Social from "@/components/home/Social";

export default function HomePage() {
  return (
    <>
      <Hero />
      <Steps />
      {/* aisles before individual blanks: with 24 products, "what do you sell"
          has to be answerable before "here is a tee" */}
      <Categories />
      <ProductRail />
      <FeaturedGrid />
      <BulkCalculator />
      <Social />
    </>
  );
}
