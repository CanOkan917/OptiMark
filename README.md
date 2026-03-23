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

```

optimark/
│
├── main.py
├── generator/
│   ├── __init__.py
│   ├── app.py
│   ├── config.py
│   ├── drawer.py
│   ├── helpers.py
│   ├── layout.py
│   ├── sheet_generator.py
│   └── template_exporter.py
│
├── requirements.txt
└── README.md

````

---

## ⚙️ Installation

```bash
git clone https://github.com/yourusername/optimark.git
cd optimark
pip install -r requirements.txt
````

---

## ▶️ Usage

```bash
python main.py
```

Or run with camera input:

```bash
python main.py --camera
```

---

## 📸 Example

| Input Sheet | Processed Output |
| ----------- | ---------------- |
| (image)     | (graded image)   |

---

## 📊 Example Output

```
Q1: A
Q2: C
Q3: B
Score: 8/10
```

---

## 🔥 Future Improvements

* 📱 Mobile support
* 🤖 AI-based mark detection (CNN)
* 🌐 Web interface
* 🧾 Multiple template support
* ☁️ Cloud deployment

---

## 🤝 Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

---

## 📄 License

MIT License

---

## ⭐ Support

If you like this project, give it a ⭐ on GitHub!