// src/components/products/ProductCard.tsx
import Link from "next/link";
import Image from "next/image"; // Import next/image
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, Tag } from "lucide-react"; // Added Tag as a default icon

interface ProductCardProps {
  title: string;
  description: string;
  icon?: LucideIcon; // Made icon optional if imageUrl is provided
  imageUrl?: string;
  href?: string; // href is optional if card is used for selection
  onClick?: () => void; // Added onClick for selection cards
  colorClass?: string; // e.g., text-blue-500
  isSelected?: boolean; // To highlight selected card
}

export default function ProductCard({
  title,
  description,
  icon: IconComponent,
  imageUrl,
  href,
  onClick,
  colorClass = "text-primary",
  isSelected,
}: ProductCardProps) {
  const cardBaseClasses = `shadow-lg hover:shadow-xl transition-all duration-300 h-full flex flex-col transform hover:-translate-y-1`;
  const selectedClasses = isSelected ? 'ring-2 ring-accent border-accent shadow-xl' : 'border-border';
  const cursorClass = onClick || href ? 'cursor-pointer' : 'cursor-default';

  const IconDisplay = IconComponent || Tag; // Default to Tag icon if no icon or imageUrl

  const cardContent = (
    <Card className={`${cardBaseClasses} ${selectedClasses} ${cursorClass}`}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 pt-4 px-4">
        <CardTitle className="text-md sm:text-lg font-semibold font-headline leading-tight">{title}</CardTitle>
        {imageUrl ? (
          <div className="relative h-10 w-10 sm:h-12 sm:w-12 flex-shrink-0 ml-2">
            <Image
              src={imageUrl}
              alt={title}
              fill
              className="object-contain rounded-md"
              onError={(e) => (e.currentTarget.style.display = 'none')} // Hide if image fails to load
            />
          </div>
        ) : (
          IconDisplay && <IconDisplay className={`h-8 w-8 sm:h-10 sm:w-10 ${colorClass} transition-transform group-hover:scale-110 flex-shrink-0 ml-2`} />
        )}
      </CardHeader>
      <CardContent className="flex-grow flex flex-col justify-between px-4 pb-4">
        <p className="text-xs sm:text-sm text-muted-foreground mb-3 line-clamp-2">{description}</p>
        {href && (
          <div className="flex items-center text-sm text-accent-foreground group-hover:text-primary transition-colors">
            Order Now <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </div>
        )}
         {onClick && !href && (
          <div className="flex items-center text-sm text-accent-foreground group-hover:text-primary transition-colors">
            Select <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="block group h-full">
        {cardContent}
      </Link>
    );
  }

  if (onClick) {
    return (
      <div onClick={onClick} className="block group h-full">
        {cardContent}
      </div>
    );
  }

  return <div className="block group h-full">{cardContent}</div>;
}
