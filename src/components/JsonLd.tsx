type JsonLdProps = {
  data: unknown;
};

/** Renders one application/ld+json block. `<` is escaped so the payload cannot close the script tag. */
export default function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}
