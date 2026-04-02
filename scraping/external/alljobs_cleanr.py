import json

def remove_duplicates(input_file="alljobs_scraped_data.jsonl", output_file="alljobs_cleaned.jsonl"):
    seen_urls = set()
    unique_count = 0
    duplicate_count = 0

    print(f"Starting de-duplication of {input_file}...")

    # We open the output file in 'w' mode to create a fresh cleaned version
    with open(output_file, 'w', encoding='utf-8') as outfile:
        with open(input_file, 'r', encoding='utf-8') as infile:
            for line in infile:
                # Remove empty lines or whitespace
                line = line.strip()
                if not line:
                    continue

                try:
                    job_data = json.loads(line)
                    url = job_data.get("url")

                    # If we haven't seen this URL before, save it
                    if url not in seen_urls:
                        outfile.write(json.dumps(job_data, ensure_ascii=False) + '\n')
                        seen_urls.add(url)
                        unique_count += 1
                    else:
                        duplicate_count += 1
                
                except json.JSONDecodeError:
                    print(f"Skipping malformed line: {line[:50]}...")
                    continue

    print("-" * 30)
    print(f"Process Complete!")
    print(f"Unique jobs saved: {unique_count}")
    print(f"Duplicates removed: {duplicate_count}")
    print(f"Cleaned data saved to: {output_file}")

if __name__ == "__main__":
    remove_duplicates()