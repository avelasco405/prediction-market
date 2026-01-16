from setuptools import setup, find_packages

setup(
    name="prediction-market",
    version="0.1.0",
    description="High-frequency trading and automated prediction market",
    author="avelasco405",
    packages=find_packages(),
    install_requires=[
        "numpy>=1.21.0",
        "pandas>=1.3.0",
        "flask>=2.0.0",
        "flask-cors>=3.0.0",
        "sortedcontainers>=2.4.0",
    ],
    python_requires=">=3.7",
)
