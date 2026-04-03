from ds.src.pipeline.cv_pipeline import process_cv

if __name__ == "__main__":
    pdf_path = "./data/raw/test_cv.pdf"
    clean_text = process_cv(pdf_path)

    print("===== CLEAN CV TEXT =====")
    print(clean_text[:1000])