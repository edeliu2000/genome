import setuptools

with open("README.md", "r") as fh:
    long_description = fh.read()

setuptools.setup(
    name="modelstore", # Replace with your own username
    version="0.4.0",
    author="Endri Deliu",
    author_email="endrideliu@gmail.com",
    description="client for genome modelstore ",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/pypa/sampleproject",
    package_dir={"modelstore": "modelstore"},
    packages=setuptools.find_packages(exclude=["test.*", "test"]),
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
    ],
    python_requires='>=3.6',
)
