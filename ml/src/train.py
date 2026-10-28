import os
import time
import json
import joblib
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor, RandomForestClassifier
from xgboost import XGBRegressor, XGBClassifier
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score, accuracy_score, classification_report
from sklearn.preprocessing import LabelEncoder

# Set paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) # ml/ directory
DATASET_PATH = os.path.join(BASE_DIR, "datasets", "clean_telemetry.csv")
BACKEND_MODEL_DIR = os.path.join(os.path.dirname(BASE_DIR), "backend", "app", "models")

# Ensure output model directory exists
os.makedirs(BACKEND_MODEL_DIR, exist_ok=True)

# Import feature engineering
import sys
sys.path.append(BASE_DIR)
from src.feature_engineering import engineer_features, get_preprocessing_pipeline, NUMERIC_FEATURES, CATEGORICAL_FEATURES

def assign_driving_style_labels(df):
    """
    Assigns a driving style label based on telemetry features.
    Eco (0), Normal (1), Aggressive (2).
    """
    labels = []
    for idx, row in df.iterrows():
        acc = abs(row["acceleration"])
        brake = row["braking_frequency"]
        speed = row["avg_speed"]
        
        # Rule-based labelling for driving style
        if brake > 8 or acc > 0.9 or speed > 85:
            labels.append("Aggressive")
        elif brake <= 3 and acc <= 0.5 and speed <= 55:
            labels.append("Eco")
        else:
            labels.append("Normal")
            
    df["driving_style"] = labels
    return df

def train_and_compare():
    print(f"Loading telemetry dataset from {DATASET_PATH}...")
    if not os.path.exists(DATASET_PATH):
        raise FileNotFoundError(f"Dataset not found at {DATASET_PATH}. Please run data_generator.py first.")
        
    df = pd.read_csv(DATASET_PATH)
    
    # 1. Label driving styles
    df = assign_driving_style_labels(df)
    
    # 2. Engineer features
    df = engineer_features(df)
    
    # Features & Targets
    # Note: We keep categorical features as strings for preprocessor OneHotEncoder
    X = df[NUMERIC_FEATURES + CATEGORICAL_FEATURES]
    y_range = df["actual_range_km"]
    y_consumption = df["energy_consumption_wh_km"]
    y_style = df["driving_style"]
    
    # Train-test split
    X_train, X_test, y_train_range, y_test_range = train_test_split(X, y_range, test_size=0.2, random_state=42)
    _, _, y_train_cons, y_test_cons = train_test_split(X, y_consumption, test_size=0.2, random_state=42)
    
    # Fit the preprocessor on training data
    preprocessor = get_preprocessing_pipeline()
    X_train_processed = preprocessor.fit_transform(X_train)
    X_test_processed = preprocessor.transform(X_test)
    
    # Save the fitted preprocessor pipeline
    preprocessor_path = os.path.join(BACKEND_MODEL_DIR, "preprocessor.joblib")
    joblib.dump(preprocessor, preprocessor_path)
    print(f"Preprocessor saved to {preprocessor_path}")
    
    # Models to compare
    regressors = {
        "Random Forest": RandomForestRegressor(n_estimators=100, random_state=42, n_jobs=-1),
        "Gradient Boosting": GradientBoostingRegressor(n_estimators=100, random_state=42),
        "XGBoost": XGBRegressor(n_estimators=100, random_state=42, n_jobs=-1)
    }
    
    # 3. Model Comparison for Range Prediction
    print("\n--- Range Regressor Model Comparison ---")
    range_results = {}
    best_range_model_name = None
    best_range_mae = float('inf')
    best_range_model = None
    
    for name, reg in regressors.items():
        t0 = time.time()
        reg.fit(X_train_processed, y_train_range)
        t_fit = time.time() - t0
        
        t0 = time.time()
        preds = reg.predict(X_test_processed)
        t_inf = (time.time() - t0) / len(X_test_processed) * 1000 # ms per sample
        
        mae = mean_absolute_error(y_test_range, preds)
        rmse = np.sqrt(mean_squared_error(y_test_range, preds))
        r2 = r2_score(y_test_range, preds)
        
        print(f"{name}:")
        print(f"  MAE:  {mae:.3f} km")
        print(f"  RMSE: {rmse:.3f} km")
        print(f"  R2:   {r2:.4f}")
        print(f"  Fit Time: {t_fit:.3f}s | Inference Speed: {t_inf:.5f}ms/sample")
        
        range_results[name] = {
            "mae": mae,
            "rmse": rmse,
            "r2": r2,
            "inference_time_ms": t_inf
        }
        
        if mae < best_range_mae:
            best_range_mae = mae
            best_range_model_name = name
            best_range_model = reg
            
    print(f"\n>> Selected Range Model: {best_range_model_name} with MAE: {best_range_mae:.3f} km")
    
    # Save the best range predictor model
    range_model_path = os.path.join(BACKEND_MODEL_DIR, "range_predictor.joblib")
    joblib.dump(best_range_model, range_model_path)
    print(f"Saved best range model to {range_model_path}")
    
    # 4. Model Comparison for Consumption (Wh/km) Prediction
    print("\n--- Energy Consumption Regressor Model Comparison ---")
    cons_results = {}
    best_cons_model_name = None
    best_cons_mae = float('inf')
    best_cons_model = None
    
    for name, reg in regressors.items():
        t0 = time.time()
        reg.fit(X_train_processed, y_train_cons)
        t_fit = time.time() - t0
        
        t0 = time.time()
        preds = reg.predict(X_test_processed)
        t_inf = (time.time() - t0) / len(X_test_processed) * 1000 # ms per sample
        
        mae = mean_absolute_error(y_test_cons, preds)
        rmse = np.sqrt(mean_squared_error(y_test_cons, preds))
        r2 = r2_score(y_test_cons, preds)
        
        print(f"{name}:")
        print(f"  MAE:  {mae:.3f} Wh/km")
        print(f"  RMSE: {rmse:.3f} Wh/km")
        print(f"  R2:   {r2:.4f}")
        print(f"  Fit Time: {t_fit:.3f}s | Inference Speed: {t_inf:.5f}ms/sample")
        
        cons_results[name] = {
            "mae": mae,
            "rmse": rmse,
            "r2": r2,
            "inference_time_ms": t_inf
        }
        
        if mae < best_cons_mae:
            best_cons_mae = mae
            best_cons_model_name = name
            best_cons_model = reg
            
    print(f"\n>> Selected Consumption Model: {best_cons_model_name} with MAE: {best_cons_mae:.3f} Wh/km")
    
    # Save the best consumption model
    cons_model_path = os.path.join(BACKEND_MODEL_DIR, "consumption_predictor.joblib")
    joblib.dump(best_cons_model, cons_model_path)
    print(f"Saved best consumption model to {cons_model_path}")

    # 5. Train Driving Style Classifier (inferred from telemetry: speed, acceleration, braking)
    # We introduce simulated sensor noise (measurement errors) to training features 
    # to avoid a trivial deterministic decision boundary and simulate real-world telemetry noise.
    X_style = df[["avg_speed", "acceleration", "braking_frequency"]].copy()
    y_style_encoded = LabelEncoder()
    y_style_num = y_style_encoded.fit_transform(y_style) # Eco -> 0, Normal -> 1, Aggressive -> 2
    
    X_style_train_raw, X_style_test_raw, y_style_train, y_style_test = train_test_split(
        X_style, y_style_num, test_size=0.2, random_state=42
    )
    
    # Add Gaussian noise to training set only (prevent leakage to test set)
    np.random.seed(42)
    X_style_train = X_style_train_raw.copy()
    X_style_train["avg_speed"] = X_style_train["avg_speed"] + np.random.normal(0, 2.5, size=len(X_style_train)) # 2.5 km/h noise
    X_style_train["acceleration"] = X_style_train["acceleration"] + np.random.normal(0, 0.08, size=len(X_style_train)) # 0.08 m/s² noise
    X_style_train["braking_frequency"] = (X_style_train["braking_frequency"] + np.random.normal(0, 0.8, size=len(X_style_train))).round().astype(int).clip(lower=0)
    
    # Test set remains standard clean evaluation telemetry
    X_style_test = X_style_test_raw.copy()
    
    print("\n--- Training Driving Style Classifier (with sensor noise induction) ---")
    style_clf = RandomForestClassifier(n_estimators=50, random_state=42, n_jobs=-1)
    style_clf.fit(X_style_train, y_style_train)
    style_preds = style_clf.predict(X_style_test)
    style_acc = accuracy_score(y_style_test, style_preds)
    print(f"Driving Style Classifier Accuracy (Noisy Training): {style_acc * 100:.2f}%")
    print(classification_report(y_style_test, style_preds, target_names=y_style_encoded.classes_))
    
    # Save style classifier and its label encoder classes
    style_model_path = os.path.join(BACKEND_MODEL_DIR, "driving_style_classifier.joblib")
    joblib.dump(style_clf, style_model_path)
    
    style_classes_path = os.path.join(BACKEND_MODEL_DIR, "driving_style_classes.joblib")
    joblib.dump(y_style_encoded.classes_, style_classes_path)
    print(f"Saved driving style classifier and classes to {BACKEND_MODEL_DIR}")
    
    # 6. Extract Feature Importance for Explainability from Random Forest Regressor
    # (Since RF is simple and provides clean Gini-importance coefficients)
    rf_reg = regressors["Random Forest"]
    # Get feature names after one-hot encoding
    feature_names = NUMERIC_FEATURES + list(
        preprocessor.named_transformers_['cat']
        .named_steps['onehot']
        .get_feature_names_out(CATEGORICAL_FEATURES)
    )
    
    importances = rf_reg.feature_importances_
    importance_dict = dict(zip(feature_names, [float(i) for i in importances]))
    # Sort feature importances
    sorted_importances = sorted(importance_dict.items(), key=lambda x: x[1], reverse=True)
    
    # 7. Write model metadata json
    metadata = {
        "range_model_name": best_range_model_name,
        "range_model_mae": best_range_mae,
        "range_comparison": range_results,
        "consumption_model_name": best_cons_model_name,
        "consumption_model_mae": best_cons_mae,
        "consumption_comparison": cons_results,
        "style_classifier_accuracy": style_acc,
        "feature_importances": sorted_importances[:15] # Top 15 features
    }
    
    metadata_path = os.path.join(BACKEND_MODEL_DIR, "model_metadata.json")
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=4)
    print(f"Model metadata JSON saved to {metadata_path}")
    print("\nML Pipeline Complete!")

if __name__ == "__main__":
    train_and_compare()
