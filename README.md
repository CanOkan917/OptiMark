# 🎯 OptiMark

**OptiMark** is a computer vision-based Optical Mark Recognition (OMR) system that detects and evaluates bubble sheets using a camera or image input.

It can automatically identify marked answers on multiple-choice sheets and generate results with high accuracy.

---

## 🚀 Features

- 📷 Real-time camera input or image upload
- 📄 Automatic sheet detection (perspective transform)
- 🔍 Bubble detection and analysis
- ✅ Answer recognition (A, B, C, D, ...)
- 📊 Auto grading with answer key
- ⚡ Fast and efficient processing using OpenCV

---

## 🧠 How It Works

1. Capture image from camera or load image
2. Detect the exam sheet using contour detection
3. Apply perspective transform for top-down view
4. Convert to binary image using thresholding
5. Detect bubbles using contours
6. Determine filled bubbles using pixel density
7. Map answers and calculate score

---

## 🛠️ Tech Stack

- Python 🐍
- OpenCV
- NumPy
- Streamlit

---

## 📂 Project Structure


optimark/
│
├── main.py
├── utils/
│ ├── image_processing.py
│ ├── contour_utils.py
│ └── grading.py
│
├── samples/
├── requirements.txt
└── README.md


---

## ⚙️ Installation

```bash
git clone https://github.com/canokan917/OptiMark.git
cd OptiMark
pip install -r requirements.txt