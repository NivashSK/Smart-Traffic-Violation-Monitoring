import pandas as pd
import numpy as np
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.pipeline import Pipeline

# Define feature groups
NUMERIC_FEATURES = [
    "battery_pct", "battery_soh", "avg_speed", "acceleration",
    "braking_frequency", "road_gradient", "temperature", "payload",
    "phys_aero_kw", "phys_roll_kw", "phys_grade_kw", "phys_aux_kw", "phys_kinetic_demand"
]

CATEGORICAL_FEATURES = [
    "vehicle_model", "traffic_level", "road_type", "weather",
    "ac_usage", "regen_braking"
]

def get_preprocessing_pipeline(df=None):
    """
    Creates a preprocessor pipeline using standard scaling for numeric features
    and one-hot encoding for categoricals.
    """
    numeric_transformer = Pipeline(steps=[
        ('scaler', StandardScaler())
    ])
    
    # We specify categories to ensure consistent one-hot dimensions even with single-sample backend predictions
    categories = [
        # vehicle_model
        ["Tata Nexon EV", "Mahindra XUV400", "MG ZS EV", "Ather 450X", "Ola S1 Pro", "TVS iQube", "Bajaj Chetak", "Volkswagen e-Up!", "Volkswagen ID.3"],
        # traffic_level
        ["Low", "Medium", "Heavy"],
        # road_type
        ["Highway", "Urban", "Offroad"],
        # weather
        ["Clear", "Rain", "Snow"],
        # ac_usage
        [0, 1],
        # regen_braking
        [0, 1]
    ]

    categorical_transformer = Pipeline(steps=[
        ('onehot', OneHotEncoder(categories=categories, handle_unknown='ignore', sparse_output=False))
    ])

    preprocessor = ColumnTransformer(
        transformers=[
            ('num', numeric_transformer, NUMERIC_FEATURES),
            ('cat', categorical_transformer, CATEGORICAL_FEATURES)
        ]
    )

    return preprocessor

def engineer_features(df):
    """
    Applies custom feature engineering before training.
    """
    # Create copy to avoid modifying original dataframe
    data = df.copy()

    # Feature 1: Speed Consistency (represented by speed variation - for synthetic data, we can estimate it)
    # Aggressive driving leads to higher braking frequency and speed fluctuation
    data["speed_variance_score"] = data["braking_frequency"] * 0.5 + abs(data["acceleration"]) * 2.0
    
    # Feature 2: Thermal Load
    # Difference between temp and ideal temperature (22C) multiplied by AC usage
    data["thermal_load"] = abs(data["temperature"] - 22.0) * data["ac_usage"]
    
    # Feature 3: Gravity resistance indicator
    # mass indicator (vehicle base weight + payload) * sin(gradient)
    # Since vehicle weight depends on model, we can approximate this with:
    # road_gradient * (1 + payload/150)
    data["slope_payload_factor"] = data["road_gradient"] * (1.0 + data["payload"] / 150.0)
    
    # Feature 4: Efficiency Loss Index
    # Higher speed increases aerodynamic drag exponentially (v^3)
    data["kinetic_drag_index"] = (data["avg_speed"] ** 3) * 0.0001
    
    return data

if __name__ == "__main__":
    # Test on a mock dataframe
    test_df = pd.DataFrame([{
        "battery_pct": 80.0,
        "battery_soh": 95.0,
        "vehicle_model": "Tata Nexon EV",
        "avg_speed": 60.0,
        "acceleration": 0.2,
        "braking_frequency": 3,
        "traffic_level": "Medium",
        "road_type": "Urban",
        "road_gradient": 1.5,
        "weather": "Clear",
        "temperature": 25.0,
        "ac_usage": 1,
        "payload": 100.0,
        "regen_braking": 1
    }])
    
    data_engineered = engineer_features(test_df)
    preprocessor = get_preprocessing_pipeline()
    X_processed = preprocessor.fit_transform(data_engineered)
    print("Preprocessed feature array shape:", X_processed.shape)
