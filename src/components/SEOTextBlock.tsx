import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface SEOTextBlockProps {
  title: string;
  content: string[];
}

const SEOTextBlock: React.FC<SEOTextBlockProps> = ({ title, content }) => {
  return (
    <Card className="bg-card/50 mt-8">
      <CardHeader>
        <CardTitle className="text-xl font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-muted-foreground">
        {content.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </CardContent>
    </Card>
  );
};

export default SEOTextBlock;
