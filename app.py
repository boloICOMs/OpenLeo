from flask import Flask, render_template, request, jsonify, send_from_directory
import os
import torch
import torch.nn as nn
from torchvision import transforms
import torchvision.models as models
from PIL import Image
import io
import numpy as np
import cv2
from pytorch_grad_cam import GradCAM
from pytorch_grad_cam.utils.model_targets import ClassifierOutputTarget
from pytorch_grad_cam.utils.image import show_cam_on_image
import base64

# defining the classes
classes = ['architecture', 'drawing', 'engraving', 'fresco', 'glass art', 
           'manuscript', 'mosaic', 'oil painting', 'sculpture metal', 
           'sculpture stone', 'tempera (on panel)']

DATASET_PATH = os.path.join(os.getcwd(), 'dataset', 'toy_dataset')


device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model = models.efficientnet_b0(weights=None) 

#  reconstruction of model architecture
num_features = model.classifier[1].in_features


model.classifier = nn.Sequential(
    nn.Linear(num_features, 512),   
    nn.BatchNorm1d(512),            
    nn.SiLU(),                     
    nn.Dropout(p=0.5),              
    nn.Linear(512, len(classes))    
)

transform = transforms.Compose([
    transforms.Resize((224)),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
])

checkpoint = torch.load('./model/EfficientNet-B0.tar', map_location=device)
model.load_state_dict(checkpoint)
model.to(device)
model.eval()

# creating the application
app = Flask(__name__)

@app.route('/')
def home():
    examples_dir = 'examples'
    example_images = []
    if os.path.exists(examples_dir):
        for class_name in sorted(os.listdir(examples_dir)):
            class_path = os.path.join(examples_dir, class_name)
            if os.path.isdir(class_path):
                files = [f for f in os.listdir(class_path) if f.lower().endswith(('.png', '.jpg', '.jpeg'))]
                if files:
                    image_path = f"{class_name}/{files[0]}"
                    example_images.append({'class': class_name, 'path': image_path})
    return render_template('interface.html', examples=example_images)

@app.route('/info')
def info():
    return render_template('info.html')

@app.route('/examples/<path:filename>')
def serve_examples(filename):
    from flask import send_from_directory
    return send_from_directory('examples', filename)


target_layers = [model.features[-1]]
cam = GradCAM(model=model, target_layers=target_layers)

@app.route('/dataset_images/<filename>')
def serve_dataset_images(filename):
    return send_from_directory(DATASET_PATH, filename)

@app.route('/predict', methods=['POST'])
def predict():

    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'})
    
    file = request.files['file']
    img_bytes = file.read()
    image = Image.open(io.BytesIO(img_bytes)).convert('RGB')
    
    input_tensor = transform(image).unsqueeze(0).to(device)

    with torch.no_grad():
        outputs = model(input_tensor)
        probs = torch.nn.functional.softmax(outputs[0], dim=0)
        
        top5_prob, top5_indices = torch.topk(probs, 5)

    predictions = []
    for i in range(5):
        predictions.append({
            'class': classes[top5_indices[i]],
            'confidence': f"{top5_prob[i].item()*100:.2f}%"
        })

    orig_width, orig_height = image.size


    rgb_img_full = np.array(image).astype(np.float32) / 255.0
    
    
    targets = [ClassifierOutputTarget(top5_indices[0].item())]
    grayscale_cam = cam(input_tensor=input_tensor, targets=targets)[0, :]
    
    grayscale_cam_resized = cv2.resize(grayscale_cam, (orig_width, orig_height), interpolation=cv2.INTER_LANCZOS4)
    
    cam_image = show_cam_on_image(rgb_img_full, grayscale_cam_resized, use_rgb=True)

    cam_image_bgr = cv2.cvtColor(cam_image, cv2.COLOR_RGB2BGR)
    _, buffer = cv2.imencode('.jpg', cam_image_bgr)

    import base64
    img_base64 = base64.b64encode(buffer).decode('utf-8')
    
    return jsonify({
        'top_predictions': predictions,
        'gradcam_image': img_base64
    })

if __name__ == '__main__':
    app.run(debug=True)